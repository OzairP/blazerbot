export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

export function tabIndentString (str: string) {
	return str.split('\n').map(s => '\t' + s).join('\n')
}
