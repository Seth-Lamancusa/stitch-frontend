const FUNCTION_TYPES = new Set(['function_invocation', 'function_response']);

export function isFunctionMessage(message) {
  return FUNCTION_TYPES.has(message?.type);
}

function dictionary(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  return content;
}

export function functionCallName(content) {
  const name = dictionary(content)?.name;
  return typeof name === 'string' ? name : '';
}

export function functionResponseName(message, parent) {
  if (parent?.type !== 'function_invocation') return '';
  return functionCallName(parent.content);
}

export function functionKind(message) {
  return message?.type === 'function_invocation' ? 'function call' : 'function response';
}

export function functionLabel(message, parent) {
  const kind = functionKind(message);
  const name = message?.type === 'function_invocation'
    ? functionCallName(message?.content)
    : functionResponseName(message, parent);
  return name ? `${kind}: ${name}` : kind;
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'string';
}

export function invocationPreview(name, parameters) {
  const label = name || 'function';
  if (Array.isArray(parameters)) {
    if (!parameters.length) return `${label}()`;
    return `${label}(${parameters.map(valueType).join(', ')})`;
  }
  if (parameters && typeof parameters === 'object') {
    const keys = Object.keys(parameters);
    if (!keys.length) return `${label}()`;
    return `${label}(${keys.join(', ')})`;
  }
  return `${label}()`;
}

function formatJson(value) {
  try {
    const rendered = JSON.stringify(value);
    return rendered === undefined ? String(value) : rendered;
  } catch {
    return String(value);
  }
}

function formatInvocation(name, parameters) {
  if (Array.isArray(parameters)) {
    if (!parameters.length) return `${name}()`;
    const lines = parameters.map((param) => `  ${formatJson(param)}`);
    return `${name}(\n${lines.join(',\n')}\n)`;
  }
  if (parameters && typeof parameters === 'object') {
    const keys = Object.keys(parameters);
    if (!keys.length) return `${name}()`;
    const lines = keys.map((key) => `  ${key}: ${formatJson(parameters[key])}`);
    return `${name}(\n${lines.join(',\n')}\n)`;
  }
  return `${name}()`;
}

function formatOutput(output) {
  if (typeof output === 'string') return output;
  if (output === undefined) return '';
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

function formatResponse(name, output) {
  if (!name) return formatOutput(output);
  if (typeof output === 'string') {
    const body = output.split('\n').map((line) => `  ${line}`).join('\n');
    return `${name}(\n${body}\n)`;
  }
  if (output === undefined) return `${name}()`;
  try {
    return `${name}(${JSON.stringify(output, null, 2)})`;
  } catch {
    return `${name}(\n  ${String(output)}\n)`;
  }
}

export function functionCode(message, parent) {
  const content = dictionary(message?.content);
  if (message?.type === 'function_invocation') {
    const name = functionCallName(content) || 'function';
    return formatInvocation(name, content?.parameters);
  }
  return formatResponse(functionResponseName(message, parent), content?.output);
}
