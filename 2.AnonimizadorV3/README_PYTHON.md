# Motor de Anonimização de Planilhas (Python CLI)

Esta pasta contém o motor principal em Python para a proteção e descaracterização de dados sensíveis locais (em conformidade com a LGPD). A ferramenta opera diretamente através de **Linha de Comando (CLI / Console)**.

---

## 🛠️ Instalação das Dependências

Instale as dependências executando o comando abaixo no terminal:

```bash
pip install -r requirements.txt
```

> **Nota:** As dependências principais são:
> * `pandas` e `openpyxl`: Leitura, escrita e preservação de estilos/fórmulas em planilhas Excel (`.xlsx`).
> * `odfpy` (opcional): Suporte para planilhas LibreOffice (`.ods`).
> * `xlrd` (opcional): Suporte para leitura de planilhas Excel antigas (`.xls`).

---

## 🚀 Como Executar via Console (CLI)

O script principal é o `anonymizer.py`. Ele processa as planilhas a partir de parâmetros fornecidos no terminal:

```bash
python anonymizer.py --input "planilha_original.xlsx" --output "planilha_anonima.xlsx" --sheet "Sheet1" --config "regras.json" --start-row 2
```

### Parâmetros Suportados:
* `--input` / `-i` (Obrigatório): Caminho do arquivo de entrada (`.xlsx`, `.csv`, `.xls`, `.ods`).
* `--output` / `-o` (Obrigatório): Caminho para salvar o arquivo resultante.
* `--sheet` / `-s` (Opcional, padrão `Sheet1`): Nome da aba que será processada.
* `--config` / `-c` (Obrigatório): Caminho para um arquivo JSON contendo as regras de configuração por coluna.
* `--start-row` (Opcional, padrão `1`): Número da linha inicial onde a anonimização começará.
* `--end-row` (Opcional): Número da linha onde o processamento deve parar.

---

## 📂 Formato do Arquivo de Configuração (`regras.json`)

Você deve fornecer um arquivo JSON estruturado que mapeia cada coluna (pela letra correspondente) para as regras de texto e de número. Veja o exemplo abaixo:

```json
{
  "A": {
    "textMethod": "fake_name",
    "numberMethod": "none"
  },
  "B": {
    "textMethod": "fake_cpf",
    "numberMethod": "fake_cpf"
  },
  "C": {
    "textMethod": "none",
    "numberMethod": "perturb_number"
  },
  "D": {
    "textMethod": "fake_email",
    "numberMethod": "none"
  }
}
```

---

## 🛡️ Regras de Anonimização Disponíveis

Você pode escolher entre os seguintes métodos na chave `textMethod` e `numberMethod`:

* **`none`**: Mantém o dado original intacto.
* **`mask_text`**: Oculta parte do texto (Ex: `Jo***va`).
* **`mask_email`**: Oculta parte do e-mail preservando domínio (Ex: `j***@e***.com`).
* **`mask_phone`**: Oculta o número do telefone mantendo o DDD (Ex: `(11) *****-****`).
* **`mask_cpf`**: Oculta dígitos do CPF (Ex: `***.456.789-**`).
* **`fake_name`**: Substitui por nomes fictícios brasileiros comuns de forma determinística.
* **`fake_cpf`**: Gera CPFs fictícios válidos.
* **`fake_phone`**: Gera telefones fictícios válidos.
* **`fake_email`**: Gera e-mails fictícios correspondentes ao nome fictício gerado.
* **`hash_sha256`**: Converte em hash criptográfico irreversível SHA-256.
* **`generalize_age`**: Agrupa idades numéricas em faixas etárias (Ex: `18-29`, `30-39`, etc.).
* **`perturb_number`**: Adiciona ou subtrai um percentual determinístico (+/- 10%) em valores numéricos.
* **`remove`**: Apaga o valor da célula (deixando-a em branco).

---

## 📂 Estrutura dos Arquivos Python

* [anonymizer.py](file:///c:/Users/Arthur%20Cavalcante/Documents/1.Laborat%C3%B3rio/2.AnonimizadorV3/anonymizer.py): Módulo core contendo todas as funções e comandos da interface via terminal.
* [requirements.txt](file:///c:/Users/Arthur%20Cavalcante/Documents/1.Laborat%C3%B3rio/2.AnonimizadorV3/requirements.txt): Relação limpa de dependências.
