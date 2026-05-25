import React from 'react';
import { ANONYMIZE_METHODS } from '../utils/anonymizer';
import type { AnonymizeMethod } from '../utils/anonymizer';
import { Settings, Shield, Play, Download, Sparkles, RefreshCw } from 'lucide-react';

interface ConfigurationPanelProps {
  headers: string[];
  columnConfigs: Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }>;
  onColumnMethodChange: (header: string, type: 'text' | 'number', method: AnonymizeMethod) => void;
  onApplyBatch: (action: AnonymizeMethod | 'reset' | 'autodetect') => void;
  onProcessFile: () => void;
  onDownloadFile: () => void;
  isProcessing: boolean;
  progress: number;
  isProcessed: boolean;
  processedFileName: string | null;
  startRow: number;
  endRow: number;
  totalRows: number;
  onStartRowChange: (val: number) => void;
  onEndRowChange: (val: number) => void;
  excludedColumns: Set<string>;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  headers,
  columnConfigs,
  onColumnMethodChange,
  onApplyBatch,
  onProcessFile,
  onDownloadFile,
  isProcessing,
  progress,
  isProcessed,
  processedFileName,
  startRow,
  endRow,
  totalRows,
  onStartRowChange,
  onEndRowChange,
  excludedColumns,
}) => {
  const isColActive = (header: string) => !excludedColumns.has(header);

  const configuredCount = Object.keys(columnConfigs).filter(
    (header) => {
      const cfg = columnConfigs[header];
      const active = isColActive(header);
      return active && (cfg.textMethod !== 'none' || cfg.numberMethod !== 'none');
    }
  ).length;
  
  const totalCount = headers.length;

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">
          <Settings size={20} className="text-primary" />
          <span>Configurações</span>
        </div>
      </div>
      
      <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Statistics Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
          <Shield size={18} style={{ color: 'var(--color-primary)' }} />
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Colunas Configuradas</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {configuredCount} / {totalCount} colunas
            </div>
          </div>
        </div>

        {/* Row Range Configuration */}
        <div>
          <div className="batch-config-label" style={{ marginBottom: '0.5rem' }}>Intervalo de Linhas (Filtro)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Linha Inicial:</span>
              <input
                type="number"
                className="col-select"
                style={{ height: '32px', padding: '0.25rem 0.5rem', margin: 0, textAlign: 'center' }}
                value={startRow}
                min={1}
                max={totalRows}
                onChange={(e) => onStartRowChange(Math.max(1, Math.min(totalRows, parseInt(e.target.value) || 1)))}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Linha Final:</span>
              <input
                type="number"
                className="col-select"
                style={{ height: '32px', padding: '0.25rem 0.5rem', margin: 0, textAlign: 'center' }}
                value={endRow}
                min={1}
                max={totalRows}
                onChange={(e) => onEndRowChange(Math.max(1, Math.min(totalRows, parseInt(e.target.value) || totalRows)))}
              />
            </div>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: '1.4' }}>
            Apenas células entre a linha {startRow} e a linha {endRow} serão anonimizadas.
          </div>
        </div>

        {/* Batch Operations */}
        <div>
          <div className="batch-config-label" style={{ marginBottom: '0.5rem' }}>Ações Rápidas em Lote</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                boxShadow: 'none',
                height: 'auto',
                justifyContent: 'flex-start'
              }}
              onClick={() => onApplyBatch('autodetect')}
              title="Detecta cabeçalhos comuns e pré-configura as regras adequadas para texto e número"
            >
              <Sparkles size={14} style={{ color: 'var(--color-accent-purple)', marginRight: '0.5rem' }} />
              Autodetectar Regras Inteligentes
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
              <select
                className="col-select"
                style={{ height: '36px', fontSize: '0.8rem' }}
                defaultValue="none"
                onChange={(e) => {
                  if (e.target.value !== 'none') {
                    onApplyBatch(e.target.value as AnonymizeMethod);
                    e.target.value = 'none'; // reset selector back
                  }
                }}
              >
                <option value="none" disabled>Aplicar regra geral a tudo...</option>
                {ANONYMIZE_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              
              <button
                className="btn-primary"
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: 'var(--color-danger)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  boxShadow: 'none',
                  height: '36px'
                }}
                onClick={() => onApplyBatch('reset')}
                title="Resetar todas as regras"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

        {/* Detailed columns checklist */}
        <div style={{ flex: 1 }}>
          <div className="batch-config-label" style={{ marginBottom: '0.5rem' }}>Configuração por Coluna</div>
          <div className="config-list" style={{ maxHeight: '250px' }}>
            {headers.map((header) => {
              const currentConfig = columnConfigs[header] || { textMethod: 'none', numberMethod: 'none' };
              const colActive = isColActive(header);
              const isConfigured = colActive && (currentConfig.textMethod !== 'none' || currentConfig.numberMethod !== 'none');
              
              return (
                <div 
                  key={header} 
                  className="config-item"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '0.5rem',
                    opacity: colActive ? 1 : 0.45,
                    borderLeft: isConfigured ? '3px solid var(--color-primary)' : '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="config-item-name" title={header} style={{ maxWidth: '80%' }}>
                      {header}
                    </span>
                    {!colActive && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>Desativada</span>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {/* Text Rule */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Se for T:</span>
                      <select
                        className="col-select"
                        style={{ width: '100%', padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                        value={currentConfig.textMethod}
                        onChange={(e) => onColumnMethodChange(header, 'text', e.target.value as AnonymizeMethod)}
                        disabled={!colActive}
                      >
                        {ANONYMIZE_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Number Rule */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Se for N:</span>
                      <select
                        className="col-select"
                        style={{ width: '100%', padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                        value={currentConfig.numberMethod}
                        onChange={(e) => onColumnMethodChange(header, 'number', e.target.value as AnonymizeMethod)}
                        disabled={!colActive}
                      >
                        {ANONYMIZE_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Execution panel */}
        <div className="actions-card">
          {!isProcessing && !isProcessed && (
            <button
              className="btn-primary"
              onClick={onProcessFile}
              disabled={configuredCount === 0}
            >
              <Play size={18} fill="currentColor" />
              Anonimizar Dados
            </button>
          )}

          {isProcessing && (
            <div className="processing-overlay" style={{ padding: '1rem 0' }}>
              <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', alignItems: 'center' }}>
                <span className="progress-percentage">{Math.round(progress)}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Processando linhas...</span>
                <div className="progress-bar-container" style={{ maxWidth: '200px', height: '6px', marginTop: '0.25rem' }}>
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {isProcessed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn-primary btn-download"
                onClick={onDownloadFile}
              >
                <Download size={18} />
                Baixar Planilha
              </button>
              
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
                {processedFileName}
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
