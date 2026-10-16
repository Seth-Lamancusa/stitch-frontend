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

function formatInvocation(name, parameters) {
  const args = Array.isArray(parameters) ? parameters : [];
  if (!args.length) return `${name}()`;
  const lines = args.map((param) => `  ${JSON.stringify(param)}`);
  return `${name}(\n${lines.join(',\n')}\n)`;
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
