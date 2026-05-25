// Anonymization rules and generators for client-side processing

// Deterministic seed generation based on string hashing (djb2 algorithm)
export function getSeed(str: string): number {
  if (!str) return 0;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function isNumeric(value: any): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'number') return true;
  const str = String(value).trim();
  if (str === '') return false;
  return !isNaN(Number(str)) && !isNaN(parseFloat(str));
}

// Common Brazilian names for realistic fake data substitution
const firstNames = [
  'Alexandre', 'Ana', 'André', 'Antônio', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 
  'Carolina', 'Daniel', 'Diego', 'Eduardo', 'Eliane', 'Felipe', 'Fernanda', 'Fernando', 
  'Gabriel', 'Gabriela', 'Guilherme', 'Gustavo', 'Helena', 'Isabela', 'João', 'Juliana', 
  'Julio', 'Larissa', 'Leonardo', 'Lucas', 'Luana', 'Luiz', 'Manuela', 'Marcelo', 
  'Marcos', 'Maria', 'Mariana', 'Mateus', 'Maurício', 'Natália', 'Patricia', 'Pedro', 
  'Rafael', 'Rafaela', 'Ricardo', 'Rodrigo', 'Sandra', 'Thiago', 'Valéria', 'Victor', 
  'Vinícius', 'Yasmin'
];

const lastNames = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 
  'Soares', 'Dias', 'Vieira', 'Barbosa', 'Rocha', 'Cardoso', 'Araújo', 'Nascimento', 
  'Cavalcante', 'Melo', 'Moreira', 'Teixeira', 'Mendes', 'Borges', 'Freitas', 'Pinto', 
  'Fonseca', 'Barros'
];

// Generates a valid Brazilian CPF deterministically
function generateCPF(seedNum: number): string {
  const cpfDigits: number[] = [];
  let tempSeed = seedNum;
  for (let i = 0; i < 9; i++) {
    cpfDigits.push(tempSeed % 10);
    tempSeed = Math.floor(tempSeed / 10);
    if (tempSeed === 0) tempSeed = seedNum + i + 7;
  }

  // Calculate first verifier digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += cpfDigits[i] * (10 - i);
  }
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  cpfDigits.push(d1);

  // Calculate second verifier digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += cpfDigits[i] * (11 - i);
  }
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  cpfDigits.push(d2);

  const digits = cpfDigits.join('');
  return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9, 11)}`;
}

// Generates a deterministic Brazilian phone number
function generatePhone(seedNum: number): string {
  const dddList = [11, 19, 21, 31, 41, 51, 61, 71, 81, 85, 91];
  const ddd = dddList[seedNum % dddList.length];
  let temp = seedNum;
  let digits = '';
  for (let i = 0; i < 8; i++) {
    digits += (temp % 10).toString();
    temp = Math.floor(temp / 10);
    if (temp === 0) temp = seedNum + i + 17;
  }
  return `(${ddd}) 9${digits.substring(0, 4)}-${digits.substring(4, 8)}`;
}

// Generates deterministic email using the fake name
function generateEmail(seedNum: number, fakeName: string): string {
  const cleanName = fakeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.');
  const domains = ['exemplo.com.br', 'empresa.com.br', 'teste.com.br', 'provedor.com.br', 'anonimo.com.br'];
  const domain = domains[seedNum % domains.length];
  return `${cleanName}@${domain}`;
}

// Generates a deterministic full name
function generateFullName(seedNum: number): string {
  const first = firstNames[seedNum % firstNames.length];
  const last1 = lastNames[(seedNum + 3) % lastNames.length];
  const last2 = lastNames[(seedNum + 7) % lastNames.length];
  return `${first} ${last1} ${last2}`;
}

// Masking helpers
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return maskText(email);
  const [local, domain] = parts;
  let maskedLocal = '';
  if (local.length > 2) {
    maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  } else {
    maskedLocal = '*'.repeat(local.length);
  }
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map((part, idx) => {
    if (idx === domainParts.length - 1) return part; // Keep extension like .com
    if (part.length > 2) {
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
    }
    return '*'.repeat(part.length);
  }).join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

function maskPhone(phone: string): string {
  let count = 0;
  return phone.split('').map((char) => {
    if (/\d/.test(char)) {
      count++;
      if (count > 2) { // Mask all digits after the DDD
        return '*';
      }
    }
    return char;
  }).join('');
}

function maskCPF(cpf: string): string {
  let count = 0;
  return cpf.split('').map((char) => {
    if (/\d/.test(char)) {
      count++;
      // Standard Brazilian format: ***.456.789-**
      if (count <= 3 || count > 9) {
        return '*';
      }
    }
    return char;
  }).join('');
}

function maskText(text: string): string {
  if (text.length <= 4) return '*'.repeat(text.length);
  return text.substring(0, 2) + '*'.repeat(text.length - 4) + text.substring(text.length - 2);
}

function generalizeAge(value: any): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) return String(value);
  if (num < 18) return 'Menor de 18';
  if (num < 30) return '18-29';
  if (num < 40) return '30-39';
  if (num < 50) return '40-49';
  if (num < 60) return '50-59';
  return '60+';
}

function perturbNumber(value: any, seedNum: number): any {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const percent = ((seedNum % 21) - 10) / 100; // Deterministic value between -10% and +10%
  const result = num * (1 + percent);
  return Number(result.toFixed(2));
}

// Asynchronously compute SHA-256 hash using Web Crypto API
export async function sha256(text: string): Promise<string> {
  if (!text) return '';
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export type AnonymizeMethod =
  | 'none'
  | 'mask_text'
  | 'mask_email'
  | 'mask_phone'
  | 'mask_cpf'
  | 'hash_sha256'
  | 'fake_name'
  | 'fake_cpf'
  | 'fake_phone'
  | 'fake_email'
  | 'generalize_age'
  | 'perturb_number'
  | 'remove';

export interface MethodDefinition {
  value: AnonymizeMethod;
  label: string;
  category: 'original' | 'mascarar' | 'ficticio' | 'outros';
}

export const ANONYMIZE_METHODS: MethodDefinition[] = [
  { value: 'none', label: 'Manter Original', category: 'original' },
  { value: 'mask_text', label: 'Mascarar Texto (Ex: Jo***va)', category: 'mascarar' },
  { value: 'mask_email', label: 'Mascarar E-mail (Ex: j***@e***.com)', category: 'mascarar' },
  { value: 'mask_phone', label: 'Mascarar Telefone (Ex: (11) *****-****)', category: 'mascarar' },
  { value: 'mask_cpf', label: 'Mascarar CPF (Ex: ***.456.789-**)', category: 'mascarar' },
  { value: 'fake_name', label: 'Nome Fictício Aleatório', category: 'ficticio' },
  { value: 'fake_cpf', label: 'CPF Fictício Válido', category: 'ficticio' },
  { value: 'fake_phone', label: 'Telefone Fictício Válido', category: 'ficticio' },
  { value: 'fake_email', label: 'E-mail Fictício Aleatório', category: 'ficticio' },
  { value: 'hash_sha256', label: 'Hash Criptográfico (SHA-256)', category: 'outros' },
  { value: 'generalize_age', label: 'Faixa Etária (Ex: 30-39)', category: 'outros' },
  { value: 'perturb_number', label: 'Perturbar Valor (+/- 10%)', category: 'outros' },
  { value: 'remove', label: 'Remover Coluna', category: 'outros' }
];

// Principal function to anonymize a cell value
export async function anonymizeCell(
  value: any,
  method: AnonymizeMethod,
  seedString: string
): Promise<any> {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const strValue = String(value).trim();
  if (strValue === '') return '';

  const seed = getSeed(seedString || strValue);

  switch (method) {
    case 'none':
      return value;
    case 'mask_text':
      return maskText(strValue);
    case 'mask_email':
      return maskEmail(strValue);
    case 'mask_phone':
      return maskPhone(strValue);
    case 'mask_cpf':
      return maskCPF(strValue);
    case 'hash_sha256':
      return await sha256(strValue);
    case 'fake_name':
      return generateFullName(seed);
    case 'fake_cpf':
      return generateCPF(seed);
    case 'fake_phone':
      return generatePhone(seed);
    case 'fake_email': {
      const nameSeed = generateFullName(seed);
      return generateEmail(seed, nameSeed);
    }
    case 'generalize_age':
      return generalizeAge(value);
    case 'perturb_number':
      return perturbNumber(value, seed);
    case 'remove':
      return '';
    default:
      return value;
  }
}
