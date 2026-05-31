"""
Módulo Principal de Anonimização de Dados (anonymizer.py)
Este módulo é responsável por processar os dados das planilhas (Excel/CSV/ODS)
e aplicar regras de anonimização determinísticas baseadas em sementes (seeds) de hash.
Ele foi traduzido do TypeScript para Python e otimizado para manter compatibilidade,
preservando estilos e fórmulas nas planilhas.
"""

import re
import hashlib
import unicodedata
import os
from typing import Any, Dict, List, Set, Union, Callable, Optional, Tuple
import openpyxl
from openpyxl.utils import get_column_letter
import pandas as pd

# ==========================================
# 1. LISTAS DE NOMES E SOBRENOMES SINTÉTICOS
# ==========================================

# Nomes masculinos e femininos comuns no Brasil
FIRST_NAMES = [
    'Alexandre', 'Ana', 'André', 'Antônio', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 
    'Carolina', 'Daniel', 'Diego', 'Eduardo', 'Eliane', 'Felipe', 'Fernanda', 'Fernando', 
    'Gabriel', 'Gabriela', 'Guilherme', 'Gustavo', 'Helena', 'Isabela', 'João', 'Juliana', 
    'Julio', 'Larissa', 'Leonardo', 'Lucas', 'Luana', 'Luiz', 'Manuela', 'Marcelo', 
    'Marcos', 'Maria', 'Mariana', 'Mateus', 'Maurício', 'Natália', 'Patricia', 'Pedro', 
    'Rafael', 'Rafaela', 'Ricardo', 'Rodrigo', 'Sandra', 'Thiago', 'Valéria', 'Victor', 
    'Vinícius', 'Yasmin'
]

# Sobrenomes comuns brasileiros
LAST_NAMES = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 
    'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 
    'Soares', 'Dias', 'Vieira', 'Barbosa', 'Rocha', 'Cardoso', 'Araújo', 'Nascimento', 
    'Cavalcante', 'Melo', 'Moreira', 'Teixeira', 'Mendes', 'Borges', 'Freitas', 'Pinto', 
    'Fonseca', 'Barros'
]

# Definições de Métodos de Anonimização (idêntico ao TypeScript)
ANONYMIZE_METHODS = {
    'none': 'Manter Original',
    'mask_text': 'Mascarar Texto (Ex: Jo***va)',
    'mask_email': 'Mascarar E-mail (Ex: j***@e***.com)',
    'mask_phone': 'Mascarar Telefone (Ex: (11) *****-****)',
    'mask_cpf': 'Mascarar CPF (Ex: ***.456.789-**)',
    'fake_name': 'Nome Fictício Aleatório',
    'fake_cpf': 'CPF Fictício Válido',
    'fake_phone': 'Telefone Fictício Válido',
    'fake_email': 'E-mail Fictício Aleatório',
    'hash_sha256': 'Hash Criptográfico (SHA-256)',
    'generalize_age': 'Faixa Etária (Ex: 30-39)',
    'perturb_number': 'Perturbar Valor (+/- 10%)',
    'remove': 'Remover Coluna'
}

# ==========================================
# 2. FUNÇÕES AUXILIARES E GERADORES
# ==========================================

def get_seed(s: str) -> int:
    """
    Gera um seed numérico determinístico baseado no hash de uma string.
    Utiliza o algoritmo djb2 simulando overflow de inteiros de 32 bits (signed)
    para produzir resultados idênticos ao ambiente JavaScript.
    """
    if not s:
        return 0
    hash_val = 5381
    for char in s:
        # Simula: hash = ((hash << 5) + hash) + charCode
        hash_val = ((hash_val << 5) + hash_val) + ord(char)
        # Força o valor a ser tratado como um inteiro assinado de 32 bits em Python
        hash_val = (hash_val + 2**31) % 2**32 - 2**31
    return abs(hash_val)


def is_numeric(value: Any) -> bool:
    """
    Verifica se um determinado valor pode ser tratado como um número.
    """
    if value is None or value == '':
        return False
    if isinstance(value, (int, float)):
        return True
    
    # Se for string, remove espaços e tenta converter
    s = str(value).strip()
    if s == '':
        return False
    
    try:
        float(s)
        return True
    except ValueError:
        return False


def is_formula(value: Any) -> bool:
    """
    Verifica se a célula contém uma fórmula do Excel.
    Fórmulas começam com o caractere '='.
    """
    return isinstance(value, str) and value.startswith('=')


def generate_cpf(seed_num: int) -> str:
    """
    Gera um CPF brasileiro válido de forma determinística a partir de um seed.
    """
    cpf_digits = []
    temp_seed = seed_num
    
    # Gera os primeiros 9 dígitos
    for i in range(9):
        cpf_digits.append(temp_seed % 10)
        temp_seed = temp_seed // 10
        if temp_seed == 0:
            temp_seed = seed_num + i + 7
            
    # Calcula o primeiro dígito verificador
    sum_val = 0
    for i in range(9):
        sum_val += cpf_digits[i] * (10 - i)
    d1 = 11 - (sum_val % 11)
    if d1 >= 10:
        d1 = 0
    cpf_digits.append(d1)
    
    # Calcula o segundo dígito verificador
    sum_val = 0
    for i in range(10):
        sum_val += cpf_digits[i] * (11 - i)
    d2 = 11 - (sum_val % 11)
    if d2 >= 10:
        d2 = 0
    cpf_digits.append(d2)
    
    digits_str = "".join(map(str, cpf_digits))
    return f"{digits_str[0:3]}.{digits_str[3:6]}.{digits_str[6:9]}-{digits_str[9:11]}"


def generate_phone(seed_num: int) -> str:
    """
    Gera um número de celular brasileiro válido (com DDD) de forma determinística.
    """
    ddd_list = [11, 19, 21, 31, 41, 51, 61, 71, 81, 85, 91]
    ddd = ddd_list[seed_num % len(ddd_list)]
    temp = seed_num
    digits = ""
    for i in range(8):
        digits += str(temp % 10)
        temp = temp // 10
        if temp == 0:
            temp = seed_num + i + 17
    return f"({ddd}) 9{digits[0:4]}-{digits[4:8]}"


def generate_full_name(seed_num: int) -> str:
    """
    Gera um nome completo fictício com base em um seed numérico.
    """
    first = FIRST_NAMES[seed_num % len(FIRST_NAMES)]
    last1 = LAST_NAMES[(seed_num + 3) % len(LAST_NAMES)]
    last2 = LAST_NAMES[(seed_num + 7) % len(LAST_NAMES)]
    return f"{first} {last1} {last2}"


def generate_email(seed_num: int, fake_name: str) -> str:
    """
    Gera um e-mail fictício associado ao nome fictício gerado.
    Remove acentos e espaços para manter o padrão RFC.
    """
    # Remove acentuações (Ex: João -> Joao)
    nfd_form = unicodedata.normalize('NFD', fake_name)
    clean_name = "".join([c for c in nfd_form if not unicodedata.combining(c)])
    clean_name = clean_name.lower()
    
    # Substitui múltiplos espaços por pontos
    clean_name = re.sub(r'\s+', '.', clean_name)
    
    domains = ['exemplo.com.br', 'empresa.com.br', 'teste.com.br', 'provedor.com.br', 'anonimo.com.br']
    domain = domains[seed_num % len(domains)]
    return f"{clean_name}@{domain}"


# ==========================================
# 3. FUNÇÕES DE MASCARAMENTO E TRANSFORMAÇÃO
# ==========================================

def mask_text(text: str) -> str:
    """
    Mascaramento geral de texto (Ex: João -> Jo**ao ou Silva -> Si**va)
    """
    if len(text) <= 4:
        return '*' * len(text)
    return text[0:2] + '*' * (len(text) - 4) + text[-2:]


def mask_email(email: str) -> str:
    """
    Mascaramento inteligente de e-mail (Ex: fulano@provedor.com -> f****o@p******r.com)
    """
    parts = email.split('@')
    if len(parts) != 2:
        return mask_text(email)
    local, domain = parts
    
    # Mascara parte local
    if len(local) > 2:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
    else:
        masked_local = '*' * len(local)
        
    # Mascara domínios preservando extensão final (.com, .br, etc.)
    domain_parts = domain.split('.')
    masked_domain_parts = []
    for idx, part in enumerate(domain_parts):
        if idx == len(domain_parts) - 1:
            masked_domain_parts.append(part)
        elif len(part) > 2:
            masked_domain_parts.append(part[0] + '*' * (len(part) - 2) + part[-1])
        else:
            masked_domain_parts.append('*' * len(part))
            
    return f"{masked_local}@{' .'.join(masked_domain_parts).replace(' .', '.')}"


def mask_phone(phone: str) -> str:
    """
    Mascara dígitos numéricos de um telefone após o DDD (mantém parênteses e traços).
    """
    count = 0
    result = []
    for char in phone:
        if char.isdigit():
            count += 1
            if count > 2:  # Mantém apenas os dois primeiros dígitos (DDD) visíveis
                result.append('*')
                continue
        result.append(char)
    return "".join(result)


def mask_cpf(cpf: str) -> str:
    """
    Mascara dígitos de CPF mantendo formatação original (Ex: ***.456.789-**)
    """
    count = 0
    result = []
    for char in cpf:
        if char.isdigit():
            count += 1
            # Oculta primeiros 3 e últimos 2 dígitos
            if count <= 3 or count > 9:
                result.append('*')
                continue
        result.append(char)
    return "".join(result)


def generalize_age(value: Any) -> str:
    """
    Classifica idades numéricas em intervalos discretos de faixas etárias.
    """
    try:
        num = int(float(str(value).strip()))
    except ValueError:
        return str(value)
        
    if num < 18:
        return 'Menor de 18'
    elif num < 30:
        return '18-29'
    elif num < 40:
        return '30-39'
    elif num < 50:
        return '40-49'
    elif num < 60:
        return '50-59'
    else:
        return '60+'


def perturb_number(value: Any, seed_num: int) -> Union[float, Any]:
    """
    Perturba valores numéricos de forma determinística adicionando/removendo
    entre 0% e 10% (calculado via seed).
    """
    try:
        num = float(value)
    except (ValueError, TypeError):
        return value
        
    # Gera um percentual determinístico entre -10% e +10%
    percent = ((seed_num % 21) - 10) / 100.0
    result = num * (1.0 + percent)
    return round(result, 2)


def sha256_hash(text: str) -> str:
    """
    Gera um hash SHA-256 representativo do valor textual.
    """
    if not text:
        return ''
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


# ==========================================
# 4. FUNÇÃO PRINCIPAL DE ANONIMIZAÇÃO DE CÉLULA
# ==========================================

def anonymize_cell(value: Any, method: str, seed_string: str) -> Any:
    """
    Aplica a regra de anonimização selecionada para uma única célula de forma assíncrona/síncrona.
    Retorna o valor transformado.
    """
    if value is None or value == '':
        return ''
        
    str_val = str(value).strip()
    if str_val == '':
        return ''
        
    seed = get_seed(seed_string if seed_string else str_val)
    
    if method == 'none':
        return value
    elif method == 'mask_text':
        return mask_text(str_val)
    elif method == 'mask_email':
        return mask_email(str_val)
    elif method == 'mask_phone':
        return mask_phone(str_val)
    elif method == 'mask_cpf':
        return mask_cpf(str_val)
    elif method == 'hash_sha256':
        return sha256_hash(str_val)
    elif method == 'fake_name':
        return generate_full_name(seed)
    elif method == 'fake_cpf':
        return generate_cpf(seed)
    elif method == 'fake_phone':
        return generate_phone(seed)
    elif method == 'fake_email':
        name_seed = generate_full_name(seed)
        return generate_email(seed, name_seed)
    elif method == 'generalize_age':
        return generalize_age(value)
    elif method == 'perturb_number':
        return perturb_number(value, seed)
    elif method == 'remove':
        return ''
    else:
        return value


# ==========================================
# 5. PROCESSAMENTO DE ARQUIVOS (EXCEL E OUTROS)
# ==========================================

def process_file(
    input_path: str,
    output_path: str,
    sheet_name: str,
    column_configs: Dict[str, Dict[str, str]],
    start_row: int = 1,
    end_row: Optional[int] = None,
    excluded_rows: Optional[Set[int]] = None,
    included_rows: Optional[Set[int]] = None,
    excluded_columns: Optional[Set[str]] = None,
    progress_callback: Optional[Callable[[float], None]] = None
) -> None:
    """
    Lê a planilha de entrada, aplica as regras configuradas linha por linha,
    preservando fórmulas e estilos em arquivos .xlsx utilizando openpyxl.
    
    column_configs deve ter o formato:
    {
       'A': {'textMethod': 'mask_text', 'numberMethod': 'none'},
       'B': {'textMethod': 'none', 'numberMethod': 'perturb_number'}
    }
    """
    if excluded_rows is None:
        excluded_rows = set()
    if included_rows is None:
        included_rows = set()
    if excluded_columns is None:
        excluded_columns = set()
        
    _, ext = os.path.splitext(input_path.lower())
    
    # Se for XLSX, utilizamos openpyxl para preservar formatações/fórmulas
    if ext == '.xlsx':
        wb = openpyxl.load_workbook(input_path, data_only=False)
        if sheet_name not in wb.sheetnames:
            raise ValueError(f"Aba '{sheet_name}' não encontrada na planilha!")
            
        ws = wb[sheet_name]
        total_rows = ws.max_row
        
        if end_row is None or end_row > total_rows:
            end_row = total_rows
            
        # Itera linha por linha
        for r_idx in range(1, total_rows + 1):
            # Notifica progresso se callback estiver ativo
            if progress_callback:
                progress_callback((r_idx / total_rows) * 100)
                
            # Verifica se esta linha deve ser anonimizada
            in_range = (start_row <= r_idx <= end_row)
            is_row_active = (r_idx not in excluded_rows) if in_range else (r_idx in included_rows)
            
            if not is_row_active:
                continue
                
            # Percorre cada célula da linha
            for col_idx in range(1, ws.max_column + 1):
                col_letter = get_column_letter(col_idx)
                
                # Ignora se a coluna estiver desativada individualmente
                if col_letter in excluded_columns:
                    continue
                    
                cell = ws.cell(row=r_idx, column=col_idx)
                val = cell.value
                
                if val is None or val == '':
                    continue
                    
                # Ignora fórmulas do Excel para não corromper o arquivo
                if is_formula(val):
                    continue
                    
                # Obtém configuração da coluna
                config = column_configs.get(col_letter, {'textMethod': 'none', 'numberMethod': 'none'})
                
                # Identifica se o valor é numérico para escolher o método adequado
                is_num = is_numeric(val)
                method = config.get('numberMethod', 'none') if is_num else config.get('textMethod', 'none')
                
                if method == 'none':
                    continue
                elif method == 'remove':
                    cell.value = None
                    continue
                    
                # Seed baseado em: letra da coluna + linha + valor original
                seed_str = f"{col_letter}_row_{r_idx}_{val}"
                
                # Processa e atualiza o valor da célula
                cell.value = anonymize_cell(val, method, seed_str)
                
        wb.save(output_path)
        wb.close()
        
    else:
        # Se for CSV, ODS ou XLS, usamos Pandas para ler e reescrever (perde estilo)
        if ext == '.csv':
            df = pd.read_csv(input_path, header=None)
        elif ext == '.ods':
            df = pd.read_excel(input_path, sheet_name=sheet_name, engine='odf', header=None)
        elif ext == '.xls':
            df = pd.read_excel(input_path, sheet_name=sheet_name, engine='xlrd', header=None)
        else:
            raise ValueError(f"Extensão de arquivo não suportada: {ext}")
            
        total_rows = len(df)
        if end_row is None or end_row > total_rows:
            end_row = total_rows
            
        # Mapeia colunas do pandas (0, 1, 2...) para letras (A, B, C...)
        headers_letters = [get_column_letter(i+1) for i in range(len(df.columns))]
        
        # Processa cada célula no DataFrame
        for r_idx_zero_based in range(total_rows):
            r_idx_excel = r_idx_zero_based + 1
            
            if progress_callback:
                progress_callback((r_idx_excel / total_rows) * 100)
                
            in_range = (start_row <= r_idx_excel <= end_row)
            is_row_active = (r_idx_excel not in excluded_rows) if in_range else (r_idx_excel in included_rows)
            
            if not is_row_active:
                continue
                
            for col_idx_zero_based, col_name in enumerate(df.columns):
                col_letter = headers_letters[col_idx_zero_based]
                
                if col_letter in excluded_columns:
                    continue
                    
                val = df.iloc[r_idx_zero_based, col_idx_zero_based]
                if pd.isna(val) or val == '':
                    continue
                    
                config = column_configs.get(col_letter, {'textMethod': 'none', 'numberMethod': 'none'})
                is_num = is_numeric(val)
                method = config.get('numberMethod', 'none') if is_num else config.get('textMethod', 'none')
                
                if method == 'none':
                    continue
                elif method == 'remove':
                    df.iloc[r_idx_zero_based, col_idx_zero_based] = None
                    continue
                    
                seed_str = f"{col_letter}_row_{r_idx_excel}_{val}"
                df.iloc[r_idx_zero_based, col_idx_zero_based] = anonymize_cell(val, method, seed_str)
                
        # Salva o arquivo no mesmo formato
        if ext == '.csv':
            df.to_csv(output_path, index=False, header=False)
        elif ext == '.ods':
            df.to_excel(output_path, index=False, sheet_name=sheet_name, engine='odf', header=False)
        else:  # .xls (salva como .xlsx por segurança e compatibilidade moderna)
            df.to_excel(output_path, index=False, sheet_name=sheet_name, header=False)


# ==========================================
# 6. INTERFACE DE LINHA DE COMANDO (CLI)
# ==========================================

if __name__ == '__main__':
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="Anonimizador de Planilhas em Python (CLI)")
    parser.add_argument('--input', '-i', required=True, help="Caminho do arquivo de entrada (.xlsx, .csv, .xls, .ods)")
    parser.add_argument('--output', '-o', required=True, help="Caminho para salvar o arquivo de saída")
    parser.add_argument('--sheet', '-s', default="Sheet1", help="Nome da aba a ser processada (padrão: Sheet1)")
    parser.add_argument('--config', '-c', required=True, help="Arquivo JSON contendo as configurações de coluna")
    parser.add_argument('--start-row', type=int, default=1, help="Linha inicial (padrão: 1)")
    parser.add_argument('--end-row', type=int, help="Linha final (opcional)")
    
    args = parser.parse_args()
    
    try:
        with open(args.config, 'r', encoding='utf-8') as f:
            configs = json.load(f)
            
        print(f"Iniciando anonimização de '{args.input}'...")
        
        def print_progress(p):
            print(f"Progresso: {p:.1f}%", end='\r')
            
        process_file(
            input_path=args.input,
            output_path=args.output,
            sheet_name=args.sheet,
            column_configs=configs,
            start_row=args.start_row,
            end_row=args.end_row,
            progress_callback=print_progress
        )
        print("\nProcessamento finalizado com sucesso!")
        print(f"Arquivo salvo em: {args.output}")
        
    except Exception as e:
        print(f"\nErro no processamento: {e}")
