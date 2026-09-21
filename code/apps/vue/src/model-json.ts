// IOT-PRODUCT-001: preserve and locate errors in the model JSON draft.
export type JsonDraftResult<T> = { value: T; error?: never } | { value?: never; error: { message: string; line: number; column: number; offset: number } };

function errorOffset(source: string): number {
  let index = 0;
  const fail = (): never => { throw index; };
  const space = () => { while (/\s/.test(source[index] ?? '')) index++; };
  const string = () => {
    if (source[index++] !== '"') fail();
    while (index < source.length) {
      const char = source[index++];
      if (char === '"') return;
      if (char === '\\') {
        const escape = source[index++];
        if (escape === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(source.slice(index, index + 4))) fail(); index += 4; }
        else if (!'"\\/bfnrt'.includes(escape ?? '')) fail();
      } else if (char.charCodeAt(0) < 32) fail();
    }
    fail();
  };
  const value = (): void => {
    space();
    const char = source[index];
    if (char === '"') { string(); return; }
    if (char === '{') {
      index++; space(); if (source[index] === '}') { index++; return; }
      while (index < source.length) {
        space(); if (source[index] !== '"') fail(); string(); space();
        if (source[index++] !== ':') fail(); value(); space();
        if (source[index] === '}') { index++; return; }
        if (source[index++] !== ',') fail();
      }
      fail();
    }
    if (char === '[') {
      index++; space(); if (source[index] === ']') { index++; return; }
      while (index < source.length) {
        value(); space();
        if (source[index] === ']') { index++; return; }
        if (source[index++] !== ',') fail();
      }
      fail();
    }
    const literal = ['true', 'false', 'null'].find(word => source.startsWith(word, index));
    if (literal) { index += literal.length; return; }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) { index += number[0].length; return; }
    fail();
  };
  try { value(); space(); if (index < source.length) fail(); } catch (offset) { return Math.min(source.length, Math.max(0, Number(offset) || 0)); }
  return source.length;
}

export function parseJsonObject<T extends object>(source: string): JsonDraftResult<T> {
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('JSON 顶层须为对象');
    return { value: value as T };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'JSON 格式无效';
    const offset = message === 'JSON 顶层须为对象' ? 0 : errorOffset(source);
    const before = source.slice(0, offset).split('\n');
    const line = before.length, column = before.at(-1)!.length + 1;
    return { error: { message: `JSON 格式错误：第 ${line} 行第 ${column} 列：${message}`, line, column, offset } };
  }
}
