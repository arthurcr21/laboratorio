import { useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { FileDropzone } from './components/FileDropzone';
import { PreviewTable } from './components/PreviewTable';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { anonymizeCell, isNumeric, getColumnLetter } from './utils/anonymizer';
import type { AnonymizeMethod } from './utils/anonymizer';
import { FileSpreadsheet, Trash2, ShieldCheck, HardDrive, Lock, Sparkles, Download } from 'lucide-react';

export default function App() {
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheetName, setCurrentSheetName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  
  // Configuration state
  const [columnConfigs, setColumnConfigs] = useState<Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }>>({});
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedBuffer, setProcessedBuffer] = useState<ArrayBuffer | null>(null);
  const [processedFileName, setProcessedFileName] = useState<string | null>(null);
  
  // Row filter states
  const [startRow, setStartRow] = useState<number>(1);
  const [endRow, setEndRow] = useState<number>(1);
  
  // Individual toggles states
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [includedRows, setIncludedRows] = useState<Set<number>>(new Set());
  const [excludedColumns, setExcludedColumns] = useState<Set<string>>(new Set());

  // Load workbook and initial sheet
  const handleFileSelected = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as ArrayBuffer;
      if (!data) return;
      
      setFileBuffer(data);
      
      try {
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setFile(selectedFile);
        
        // Load the first sheet by default
        loadSheet(wb, wb.SheetNames[0]);
      } catch (err) {
        console.error(err);
        alert('Erro ao carregar a planilha. Verifique se o arquivo está corrompido.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Extract cells from a specific worksheet
  const loadSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    setCurrentSheetName(sheetName);
    const worksheet = wb.Sheets[sheetName];
    
    // Convert to JSON array of arrays (header: 1 includes raw cells)
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      setHeaders([]);
      setRows([]);
      setPreviewRows([]);
      setColumnConfigs({});
      return;
    }
    
    // Find maximum columns across all rows to avoid truncation
    const maxCols = Math.max(...jsonData.map(row => row.length));
    
    // Generate headers as Excel column letters (A, B, C...)
    const fileHeaders = Array.from({ length: maxCols }, (_, idx) => getColumnLetter(idx));
    const fileRows = jsonData; // Keep all rows including row 1
    
    setHeaders(fileHeaders);
    setRows(fileRows);
    setPreviewRows(fileRows.slice(0, 30)); // Preview first 30 rows
    setStartRow(1);
    setEndRow(fileRows.length);
    setExcludedRows(new Set());
    setIncludedRows(new Set());
    setExcludedColumns(new Set());
    
    // Initialize column configs to none/none
    const initialConfigs: Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }> = {};
    fileHeaders.forEach((h) => {
      initialConfigs[h] = { textMethod: 'none', numberMethod: 'none' };
    });
    setColumnConfigs(initialConfigs);
    
    // Reset processing states
    setIsProcessing(false);
    setProgress(0);
    setIsProcessed(false);
    setProcessedBuffer(null);
    setProcessedFileName(null);
  };

  // Change active sheet in workbook
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    loadSheet(workbook, sheetName);
  };

  // Toggle individual row active status
  const handleToggleRow = (rowNum: number) => {
    const inRange = rowNum >= startRow && rowNum <= endRow;
    if (inRange) {
      setExcludedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowNum)) next.delete(rowNum);
        else next.add(rowNum);
        return next;
      });
    } else {
      setIncludedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowNum)) next.delete(rowNum);
        else next.add(rowNum);
        return next;
      });
    }
    setIsProcessed(false);
  };

  // Toggle individual column active status
  const handleToggleColumn = (header: string) => {
    setExcludedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
    setIsProcessed(false);
  };

  // Handle individual column change
  const handleColumnMethodChange = (header: string, type: 'text' | 'number', method: AnonymizeMethod) => {
    setColumnConfigs((prev) => {
      const current = prev[header] || { textMethod: 'none', numberMethod: 'none' };
      return {
        ...prev,
        [header]: {
          ...current,
          [type === 'text' ? 'textMethod' : 'numberMethod']: method,
        },
      };
    });
    setIsProcessed(false);
  };

  // Handle batch configurations
  const handleApplyBatch = (action: AnonymizeMethod | 'reset' | 'autodetect') => {
    if (action === 'reset') {
      const reset: Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }> = {};
      headers.forEach((h) => {
        reset[h] = { textMethod: 'none', numberMethod: 'none' };
      });
      setColumnConfigs(reset);
      setIsProcessed(false);
    } else if (action === 'autodetect') {
      const detected: Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }> = { ...columnConfigs };
      headers.forEach((h) => {
        const lower = h.toLowerCase();
        const config = { textMethod: 'none' as AnonymizeMethod, numberMethod: 'none' as AnonymizeMethod };
        
        if (lower.includes('cpf')) {
          config.textMethod = 'fake_cpf';
          config.numberMethod = 'fake_cpf';
        } else if (lower.includes('email') || lower.includes('mail')) {
          config.textMethod = 'fake_email';
        } else if (lower.includes('tel') || lower.includes('fone') || lower.includes('cel') || lower.includes('phone') || lower.includes('contato')) {
          config.textMethod = 'fake_phone';
          config.numberMethod = 'fake_phone';
        } else if (lower.includes('nome') || lower.includes('name') || lower.includes('cliente') || lower.includes('usuario') || lower.includes('proprietario')) {
          config.textMethod = 'fake_name';
        } else if (lower.includes('idade') || lower.includes('age')) {
          config.numberMethod = 'generalize_age';
          config.textMethod = 'generalize_age';
        } else if (lower.includes('salario') || lower.includes('valor') || lower.includes('preco') || lower.includes('price') || lower.includes('custo') || lower.includes('renda')) {
          config.numberMethod = 'perturb_number';
        }
        
        detected[h] = config;
      });
      setColumnConfigs(detected);
      setIsProcessed(false);
    } else {
      const batch: Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }> = {};
      headers.forEach((h) => {
        batch[h] = { textMethod: action, numberMethod: action };
      });
      setColumnConfigs(batch);
      setIsProcessed(false);
    }
  };

  // Async chunk-based processing to avoid blocking the main UI thread (using ExcelJS to preserve styles/formulas)
  const handleProcessFile = async () => {
    if (!fileBuffer || !currentSheetName) return;
    
    setIsProcessing(true);
    setProgress(0);
    setIsProcessed(false);
    
    try {
      const excelWorkbook = new ExcelJS.Workbook();
      await excelWorkbook.xlsx.load(fileBuffer);
      
      const worksheet = excelWorkbook.getWorksheet(currentSheetName);
      if (!worksheet) {
        alert('Aba não encontrada!');
        setIsProcessing(false);
        return;
      }
      
      const totalRows = worksheet.rowCount;
      const CHUNK_SIZE = 50; // Process 50 rows at a time
      let currentIndex = 1; // ExcelJS rows are 1-indexed
      
      const processChunk = async () => {
        const end = Math.min(currentIndex + CHUNK_SIZE, totalRows + 1);
        const promises: Promise<void>[] = [];
        
        for (let rIdx = currentIndex; rIdx < end; rIdx++) {
          const row = worksheet.getRow(rIdx);
          
          // Skip processing if row is not active (based on range and individual toggles)
          const inRange = rIdx >= startRow && rIdx <= endRow;
          const isRowActive = inRange ? !excludedRows.has(rIdx) : includedRows.has(rIdx);
          
          if (!isRowActive) {
            continue;
          }
          
          headers.forEach((header, colIdx) => {
            // Skip processing if column has been individually disabled
            const isColActive = !excludedColumns.has(header);
            if (!isColActive) {
              return;
            }
            const cell = row.getCell(colIdx + 1);
            const config = columnConfigs[header] || { textMethod: 'none', numberMethod: 'none' };
            
            const cellValue = cell.value;
            
            // Skip formulas to preserve them
            if (cellValue && typeof cellValue === 'object' && cellValue !== null && 'formula' in cellValue) {
              return;
            }
            
            // Extract raw value for type-checking and anonymization
            let rawVal: any = cellValue;
            if (cellValue && typeof cellValue === 'object' && cellValue !== null) {
              if ('richText' in cellValue) {
                rawVal = cell.text;
              }
            }
            
            if (rawVal === undefined || rawVal === null || rawVal === '') {
              return;
            }
            
            const isNum = isNumeric(rawVal);
            const method = isNum ? config.numberMethod : config.textMethod;
            
            if (method === 'none') return;
            if (method === 'remove') {
              cell.value = null; // Clears value and formula in-place
              return;
            }
            
            const seedString = `${header}_row_${rIdx}_${rawVal}`;
            const p = anonymizeCell(rawVal, method, seedString).then((anonValue) => {
              cell.value = anonValue;
            });
            promises.push(p);
          });
        }
        
        await Promise.all(promises);
        
        currentIndex = end;
        setProgress(((currentIndex - 1) / totalRows) * 100);
        
        if (currentIndex <= totalRows) {
          setTimeout(processChunk, 15);
        } else {
          // Processed completely! Write to buffer
          const buffer = await excelWorkbook.xlsx.writeBuffer();
          setProcessedBuffer(buffer);
          setIsProcessing(false);
          setIsProcessed(true);
          
          // Output file naming
          const fileExt = file?.name.substring(file.name.lastIndexOf('.')) || '.xlsx';
          const fileBase = file?.name.substring(0, file.name.lastIndexOf('.')) || 'planilha';
          setProcessedFileName(`${fileBase}_anonimizado${fileExt}`);
        }
      };
      
      processChunk();
    } catch (err) {
      console.error(err);
      alert('Erro ao processar a planilha com ExcelJS: ' + String(err));
      setIsProcessing(false);
    }
  };

  // Download the processed workbook, preserving the styles and formulas
  const handleDownloadFile = () => {
    if (!processedBuffer || !processedFileName) return;
    
    const blob = new Blob([processedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = processedFileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileBuffer(null);
    setProcessedBuffer(null);
    setWorkbook(null);
    setSheetNames([]);
    setCurrentSheetName('');
    setHeaders([]);
    setRows([]);
    setPreviewRows([]);
    setColumnConfigs({});
    setIsProcessing(false);
    setProgress(0);
    setIsProcessed(false);
    setProcessedFileName(null);
  };

  const fileSizeString = file ? (file.size > 1024 * 1024 
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
    : `${(file.size / 1024).toFixed(1)} KB`) : '';

  return (
    <div className="container">
      
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title-gradient">Anonimizador de Planilhas</h1>
        <p className="app-subtitle">
          Proteja dados pessoais sensíveis em conformidade com a LGPD. 
          Anonimize arquivos Excel e CSV sem que nenhuma informação saia do seu navegador.
        </p>
        <span className="badge-lgpd">
          <ShieldCheck size={14} />
          Processamento 100% Local (Client-Side)
        </span>
      </header>

      {/* Main Panel */}
      <main>
        {!file ? (
          <div>
            <FileDropzone onFileSelected={handleFileSelected} />
            
            {/* Feature Highlights */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '1.5rem', 
              marginTop: '3.5rem' 
            }}>
              
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ color: 'var(--color-accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.6rem', borderRadius: '10px', display: 'inline-flex', marginBottom: '1rem' }}>
                  <Lock size={20} />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>Segurança Absoluta</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Seus dados não são enviados para nenhum servidor ou nuvem. Tudo é processado localmente no seu computador através de scripts JavaScript.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ color: 'var(--color-accent-purple)', background: 'rgba(168, 85, 247, 0.1)', padding: '0.6rem', borderRadius: '10px', display: 'inline-flex', marginBottom: '1rem' }}>
                  <Sparkles size={20} />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>Regras Avançadas</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Aplique regras específicas baseadas no tipo de dado (se a célula for um texto ou um número).
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ color: 'var(--color-accent-green)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.6rem', borderRadius: '10px', display: 'inline-flex', marginBottom: '1rem' }}>
                  <HardDrive size={20} />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>Preservação de Formato</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Suporte a planilhas com múltiplas abas (seletor de abas inteligente) para limpar apenas os dados brutos e baixar no mesmo formato (.xlsx, .csv).
                </p>
              </div>
              
            </div>
          </div>
        ) : (
          <div>
            {/* File details bar */}
            <div className="file-info-bar glass-panel" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <div className="file-info-details">
                <div className="file-icon-wrapper">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="file-meta">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{fileSizeString} — {rows.length.toLocaleString('pt-BR')} registros</span>
                </div>
              </div>
              
              {/* Sheet Selector dropdown */}
              {sheetNames.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Aba ativa:</span>
                  <select
                    className="col-select"
                    style={{ width: '160px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', margin: 0 }}
                    value={currentSheetName}
                    onChange={(e) => handleSheetChange(e.target.value)}
                  >
                    {sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <button className="btn-remove-file" onClick={handleRemoveFile}>
                <Trash2 size={16} />
                Remover Arquivo
              </button>
            </div>

            {/* Dashboard Workspace */}
            <div className="dashboard-grid">
              {/* Left Column: Visualizer */}
              <div style={{ minWidth: 0 }}>
                <PreviewTable
                  headers={headers}
                  rows={previewRows}
                  columnConfigs={columnConfigs}
                  onColumnMethodChange={handleColumnMethodChange}
                  startRow={startRow}
                  endRow={endRow}
                  excludedRows={excludedRows}
                  includedRows={includedRows}
                  excludedColumns={excludedColumns}
                  onToggleRow={handleToggleRow}
                  onToggleColumn={handleToggleColumn}
                />
              </div>

              {/* Right Column: Configuration Sidebar */}
              <div>
                <ConfigurationPanel
                  headers={headers}
                  columnConfigs={columnConfigs}
                  onColumnMethodChange={handleColumnMethodChange}
                  onApplyBatch={handleApplyBatch}
                  onProcessFile={handleProcessFile}
                  onDownloadFile={handleDownloadFile}
                  isProcessing={isProcessing}
                  progress={progress}
                  isProcessed={isProcessed}
                  processedFileName={processedFileName}
                  startRow={startRow}
                  endRow={endRow}
                  totalRows={rows.length}
                  onStartRowChange={setStartRow}
                  onEndRowChange={setEndRow}
                  excludedColumns={excludedColumns}
                />
              </div>
            </div>

            {/* Large processing finished banner */}
            {isProcessed && (
              <div className="success-card glass-panel">
                <div className="success-icon-wrapper">
                  <ShieldCheck size={36} />
                </div>
                <h3 className="success-title">Processamento Concluído com Sucesso!</h3>
                <p className="success-description">
                  A aba <strong>{currentSheetName}</strong> da planilha foi anonimizada localmente. Todas as regras selecionadas foram aplicadas e o arquivo está pronto para download.
                </p>
                <button
                  className="btn-primary btn-download"
                  style={{ minWidth: '220px' }}
                  onClick={handleDownloadFile}
                >
                  <Download size={20} />
                  Baixar {processedFileName}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
}
