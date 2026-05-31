import React, { useState, useEffect } from 'react';
import { anonymizeCell, isNumeric, ANONYMIZE_METHODS } from '../utils/anonymizer';
import type { AnonymizeMethod } from '../utils/anonymizer';
import { Eye, ShieldAlert } from 'lucide-react';

interface PreviewCellProps {
  value: any;
  textMethod: AnonymizeMethod;
  numberMethod: AnonymizeMethod;
  columnName: string;
  rowIndex: number;
  isRowActive: boolean;
}

const PreviewCell: React.FC<PreviewCellProps> = ({ 
  value, 
  textMethod, 
  numberMethod, 
  columnName, 
  rowIndex,
  isRowActive
}) => {
  const [displayValue, setDisplayValue] = useState<any>(value);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    
    // Check cell type and check if row/column is active
    const isNum = isNumeric(value);
    const activeMethod = isRowActive ? (isNum ? numberMethod : textMethod) : 'none';

    async function load() {
      if (activeMethod === 'none') {
        if (active) setDisplayValue(value);
        return;
      }
      
      setLoading(true);
      // Construct a seed based on the index + column + value
      const seedString = `${columnName}_row_${rowIndex}_${value}`;
      const result = await anonymizeCell(value, activeMethod, seedString);
      
      if (active) {
        setDisplayValue(result);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [value, textMethod, numberMethod, columnName, rowIndex, isRowActive]);

  const isNum = isNumeric(value);
  const activeMethod = isRowActive ? (isNum ? numberMethod : textMethod) : 'none';
  const isAnonymized = activeMethod !== 'none';

  if (activeMethod === 'remove') {
    return (
      <td style={{ textDecoration: 'line-through', opacity: 0.4, color: 'var(--color-danger)', fontFamily: 'monospace' }}>
        [REMOVIDO]
      </td>
    );
  }

  return (
    <td 
      className={isAnonymized ? 'cell-anonymized' : ''}
      style={isAnonymized ? { color: 'var(--color-primary)', background: '#ebf8ff' } : {}}
    >
      {loading ? (
        <span style={{ opacity: 0.5 }}>Processando...</span>
      ) : (
        String(displayValue === undefined || displayValue === null ? '' : displayValue)
      )}
    </td>
  );
};

interface PreviewTableProps {
  headers: string[];
  rows: any[][];
  columnConfigs: Record<string, { textMethod: AnonymizeMethod; numberMethod: AnonymizeMethod }>;
  onColumnMethodChange: (header: string, type: 'text' | 'number', method: AnonymizeMethod) => void;
  startRow: number;
  endRow: number;
  excludedRows: Set<number>;
  includedRows: Set<number>;
  excludedColumns: Set<string>;
  onToggleRow: (rowNum: number) => void;
  onToggleColumn: (header: string) => void;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  headers,
  rows,
  columnConfigs,
  onColumnMethodChange,
  startRow,
  endRow,
  excludedRows,
  includedRows,
  excludedColumns,
  onToggleRow,
  onToggleColumn,
}) => {
  const getBadgeClassAndLabel = (method: AnonymizeMethod) => {
    const found = ANONYMIZE_METHODS.find((m) => m.value === method);
    if (!found) return { className: 'badge-none', label: 'Nenhum' };
    
    let className = 'badge-none';
    if (found.category === 'mascarar') className = 'badge-mascarar';
    else if (found.category === 'ficticio') className = 'badge-ficticio';
    else if (found.category === 'outros') className = method === 'remove' ? 'badge-remove' : 'badge-outros';
    
    // Short label for badges
    const shortLabel = found.label.split(' (')[0].split(' ')[0];
    return { className, label: shortLabel };
  };

  const isColActive = (header: string) => !excludedColumns.has(header);

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        <div className="card-title">
          <Eye size={20} style={{ color: 'var(--color-primary)' }} />
          <span>Visualização & Seleção Individual</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <ShieldAlert size={14} style={{ color: 'var(--color-accent-amber)' }} />
          <span>Marque/desmarque linhas e colunas para incluí-las ou excluí-las.</span>
        </div>
      </div>
      
      <div className="card-body" style={{ padding: '1rem' }}>
        <div className="table-container">
          <table className="preview-table">
            <thead>
              <tr>
                {/* Excel row index column */}
                <th style={{ width: '65px', minWidth: '65px', background: '#f1f3f7', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Ativar
                </th>
                
                {headers.map((header) => {
                  const currentConfig = columnConfigs[header] || { textMethod: 'none', numberMethod: 'none' };
                  const colActive = isColActive(header);
                  
                  const isConfigured = colActive && (currentConfig.textMethod !== 'none' || currentConfig.numberMethod !== 'none');
                  
                  const textBadge = getBadgeClassAndLabel(currentConfig.textMethod);
                  const numberBadge = getBadgeClassAndLabel(currentConfig.numberMethod);
                  
                  return (
                    <th key={header} className={isConfigured ? 'col-header-active' : ''} style={{ minWidth: '180px' }}>
                      <div className="col-header-content" style={{ gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span className="col-name" title={header} style={{ fontSize: '0.85rem' }}>{header}</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={colActive}
                              onChange={() => onToggleColumn(header)}
                              style={{ cursor: 'pointer', margin: 0 }}
                            />
                            Anonimizar
                          </label>
                        </div>
                        
                        {/* Text Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', opacity: colActive ? 1 : 0.4 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', minWidth: '12px' }}>T:</span>
                          <select
                            className="col-select"
                            style={{ padding: '0.2rem 0.35rem', fontSize: '0.7rem' }}
                            value={currentConfig.textMethod}
                            onChange={(e) => onColumnMethodChange(header, 'text', e.target.value as AnonymizeMethod)}
                            disabled={!colActive}
                          >
                            {ANONYMIZE_METHODS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Number Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', opacity: colActive ? 1 : 0.4 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', minWidth: '12px' }}>N:</span>
                          <select
                            className="col-select"
                            style={{ padding: '0.2rem 0.35rem', fontSize: '0.7rem' }}
                            value={currentConfig.numberMethod}
                            onChange={(e) => onColumnMethodChange(header, 'number', e.target.value as AnonymizeMethod)}
                            disabled={!colActive}
                          >
                            {ANONYMIZE_METHODS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Badges indicators */}
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.1rem', flexWrap: 'wrap', opacity: colActive ? 1 : 0.4 }}>
                          {colActive && currentConfig.textMethod !== 'none' && (
                            <span className={`badge-action ${textBadge.className}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }} title={`Texto: ${textBadge.label}`}>
                              T: {textBadge.label}
                            </span>
                          )}
                          {colActive && currentConfig.numberMethod !== 'none' && (
                            <span className={`badge-action ${numberBadge.className}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }} title={`Número: ${numberBadge.label}`}>
                              N: {numberBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const excelRowNum = rIdx + 1;
                const inRange = excelRowNum >= startRow && excelRowNum <= endRow;
                const isRowActive = inRange ? !excludedRows.has(excelRowNum) : includedRows.has(excelRowNum);
                
                return (
                  <tr 
                    key={rIdx} 
                    style={!isRowActive ? { opacity: 0.45, background: 'rgba(255, 255, 255, 0.01)' } : {}}
                  >
                    {/* Row Number cell with checkbox toggle */}
                    <td style={{ 
                      background: '#f1f3f7', 
                      borderRight: '1px solid var(--border-color)',
                      padding: '0.4rem 0.6rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isRowActive}
                          onChange={() => onToggleRow(excelRowNum)}
                          style={{ cursor: 'pointer', width: '13px', height: '13px', margin: 0 }}
                          title={isRowActive ? "Desativar anonimização nesta linha" : "Ativar anonimização nesta linha"}
                        />
                        <span style={{ 
                          color: isRowActive ? 'var(--text-secondary)' : 'var(--text-muted)', 
                          fontWeight: 'bold',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          minWidth: '22px',
                          textAlign: 'left'
                        }}>
                          {excelRowNum}
                        </span>
                      </div>
                    </td>
                    
                    {headers.map((header, cIdx) => {
                      const config = columnConfigs[header] || { textMethod: 'none', numberMethod: 'none' };
                      const colActive = isColActive(header);
                      return (
                        <PreviewCell
                          key={`${rIdx}-${cIdx}`}
                          value={row[cIdx]}
                          textMethod={config.textMethod}
                          numberMethod={config.numberMethod}
                          columnName={header}
                          rowIndex={rIdx}
                          isRowActive={isRowActive && colActive}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          Exibindo as primeiras {rows.length} linhas para visualização prévia.
        </div>
      </div>
    </div>
  );
};
