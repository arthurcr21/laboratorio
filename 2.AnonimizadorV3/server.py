"""
Servidor Flask Local (server.py)
Esta aplicação atua como a ponte de comunicação (API) entre o frontend web
(HTML/CSS/JS) e o motor de anonimização (anonymizer.py).
Ela gerencia uploads temporários, extrai dados de visualização (preview)
e processa planilhas salvando o resultado final sem persistir dados sensíveis no servidor.
"""

from flask import Flask, request, jsonify, render_template, send_file
import os
import openpyxl
from openpyxl.utils import get_column_letter
import pandas as pd
import io
import json
import tempfile

# Importa as funções core do anonymizer.py
from anonymizer import process_file, is_numeric, is_formula, anonymize_cell

app = Flask(__name__)

# Configura tamanho máximo de upload para 50MB
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# ==========================================
# 1. ROTA DE CARREGAMENTO DO FRONTEND
# ==========================================

@app.route('/')
def index():
    """
    Rota principal que renderiza a interface visual em HTML/CSS.
    """
    return render_template('index.html')


# ==========================================
# 2. ROTA DE PRE-VISUALIZAÇÃO (PREVIEW)
# ==========================================

@app.route('/api/preview', methods=['POST'])
def api_preview():
    """
    Recebe um arquivo de planilha enviado pelo formulário e retorna
    os nomes das abas, cabeçalhos de coluna e as primeiras 30 linhas
    para renderização da tabela de preview no frontend.
    """
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado!"}), 400
        
    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({"error": "Nome de arquivo vazio!"}), 400
        
    filename = uploaded_file.filename
    _, ext = os.path.splitext(filename.lower())
    
    try:
        # Lê os bytes na memória
        file_bytes = uploaded_file.read()
        bytes_io = io.BytesIO(file_bytes)
        
        # Identifica todas as abas (sheets) do arquivo
        sheet_names = []
        if ext == '.xlsx':
            wb = openpyxl.load_workbook(bytes_io, read_only=True)
            sheet_names = wb.sheetnames
            wb.close()
        elif ext in ['.xls', '.ods']:
            engine = 'xlrd' if ext == '.xls' else 'odf'
            xl = pd.ExcelFile(bytes_io, engine=engine)
            sheet_names = xl.sheet_names
        else:
            sheet_names = ["Sheet1"]  # CSV possui apenas uma aba conceitual
            
        # Determina a aba ativa (se passada, ou usa a primeira por padrão)
        active_sheet = request.form.get('sheet', sheet_names[0])
        if active_sheet not in sheet_names and ext in ['.xlsx', '.xls', '.ods']:
            active_sheet = sheet_names[0]
            
        # Carrega os dados da aba ativa
        bytes_io.seek(0)
        raw_rows = []
        
        if ext == '.xlsx':
            wb = openpyxl.load_workbook(bytes_io, data_only=True)
            ws = wb[active_sheet]
            for row in ws.iter_rows(values_only=True):
                raw_rows.append(list(row))
            wb.close()
        elif ext == '.ods':
            df = pd.read_excel(bytes_io, sheet_name=active_sheet, engine='odf', header=None)
            raw_rows = df.values.tolist()
        elif ext == '.xls':
            df = pd.read_excel(bytes_io, sheet_name=active_sheet, engine='xlrd', header=None)
            raw_rows = df.values.tolist()
        else:  # .csv
            # Decodifica bytes para string
            text_io = io.StringIO(file_bytes.decode('utf-8', errors='ignore'))
            df = pd.read_csv(text_io, header=None)
            raw_rows = df.values.tolist()
            
        if not raw_rows:
            return jsonify({
                "sheetNames": sheet_names,
                "currentSheet": active_sheet,
                "headers": [],
                "rows": [],
                "previewRows": []
            })
            
        # Determina o maior número de colunas para gerar as letras de cabeçalhos (A, B, C...)
        max_cols = max(len(r) for r in raw_rows)
        headers = [get_column_letter(i+1) for i in range(max_cols)]
        
        # Limita a visualização prévia a 30 linhas
        preview_rows = raw_rows[:30]
        
        # Limpa valores None para Strings vazias para evitar problemas com JSON
        formatted_preview_rows = []
        for r in preview_rows:
            row_items = []
            for item in r:
                row_items.append("" if item is None else item)
            formatted_preview_rows.append(row_items)
            
        return jsonify({
            "sheetNames": sheet_names,
            "currentSheet": active_sheet,
            "headers": headers,
            "previewRows": formatted_preview_rows,
            "totalRows": len(raw_rows)
        })
        
    except Exception as e:
        return jsonify({"error": f"Falha ao ler planilha: {str(e)}"}), 500


# ==========================================
# 3. ROTA DE PROCESSAMENTO E DOWNLOAD (ANONIMIZAÇÃO)
# ==========================================

@app.route('/api/anonymize', methods=['POST'])
def api_anonymize():
    """
    Recebe o arquivo e a configuração completa de regras de anonimização.
    Aplica as regras através de anonymizer.py salvando o resultado em disco
    temporário e envia o arquivo anonimizado de volta como stream.
    """
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado!"}), 400
        
    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({"error": "Nome de arquivo vazio!"}), 400
        
    # Obtém parâmetros de configuração
    config_json_str = request.form.get('config', '{}')
    sheet_name = request.form.get('sheet', 'Sheet1')
    start_row = int(request.form.get('startRow', 2))
    end_row = request.form.get('endRow')
    end_row = int(end_row) if end_row else None
    
    # Listas/Sets de exclusão/inclusão individual
    excluded_rows = set(json.loads(request.form.get('excludedRows', '[]')))
    included_rows = set(json.loads(request.form.get('includedRows', '[]')))
    excluded_columns = set(json.loads(request.form.get('excludedColumns', '[]')))
    
    try:
        column_configs = json.loads(config_json_str)
    except Exception:
        return jsonify({"error": "Configurações de colunas inválidas (JSON mal formatado)!"}), 400
        
    filename = uploaded_file.filename
    _, ext = os.path.splitext(filename.lower())
    
    # Criamos caminhos temporários seguros para evitar concorrência e vazamento
    with tempfile.TemporaryDirectory() as temp_dir:
        input_temp_path = os.path.join(temp_dir, f"input{ext}")
        output_temp_path = os.path.join(temp_dir, f"output{ext}")
        
        try:
            # Salva o arquivo de entrada enviado
            uploaded_file.save(input_temp_path)
            
            # Chama a rotina core do anonymizer.py
            process_file(
                input_path=input_temp_path,
                output_path=output_temp_path,
                sheet_name=sheet_name,
                column_configs=column_configs,
                start_row=start_row,
                end_row=end_row,
                excluded_rows=excluded_rows,
                included_rows=included_rows,
                excluded_columns=excluded_columns
            )
            
            # Lê o resultado gerado
            with open(output_temp_path, 'rb') as f:
                result_bytes = f.read()
                
            # Devolve o arquivo binário processado com nome customizado
            file_base, _ = os.path.splitext(filename)
            output_filename = f"{file_base}_anonimizado{ext}"
            
            # Determina o MimeType
            mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            if ext == '.csv':
                mimetype = "text/csv"
            elif ext == '.ods':
                mimetype = "application/vnd.oasis.opendocument.spreadsheet"
                
            return send_file(
                io.BytesIO(result_bytes),
                mimetype=mimetype,
                as_attachment=True,
                download_name=output_filename
            )
            
        except Exception as e:
            return jsonify({"error": f"Erro no processamento da planilha: {str(e)}"}), 500


# ==========================================
# 4. ROTA DE PRE-VISUALIZACAO CELULAR ON-THE-FLY
# ==========================================

@app.route('/api/preview-cell', methods=['POST'])
def api_preview_cell():
    """
    Recebe um valor, um método e um seedString e retorna o valor
    anonimizado para o JavaScript pré-visualizar a alteração dinamicamente na tela.
    """
    data = request.json or {}
    val = data.get('value', '')
    method = data.get('method', 'none')
    seed_str = data.get('seedString', '')
    
    if val is None or val == '':
        return jsonify({"result": ""})
        
    try:
        result = anonymize_cell(val, method, seed_str)
        return jsonify({"result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Roda o servidor local na porta 5000
    print("Iniciando o servidor Flask local em http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
