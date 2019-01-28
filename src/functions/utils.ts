export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * Partition an array into two values
 * Spread the return value of this function into a reducer
 * The Decide function will return -1 (left) or 1 (right)
 * E — Element, this is the typeof an element in the array
 * L — Left, typeof left side
 * R — Right, typeof right side
 * @example Partition even and odd numbers
 * 	[2, 3, 4]
 * 		.reduce(...partition<number, number, number>(n => n % 2 === 0 ? -1 : 1))
 * @example Partition string and numbers
 * ['1', 2, '3']
 * 		.reduce(...partition<string | number, string, number>(x => typeof x === 'string' ? -1 : 1))
 */
export function partition<E, L extends E, R extends E>(
	decide: (el: E) => -1 | 1
): [(previousValue: [L[], R[]], currentValue: E, currentIndex: number, array: E[]) => [L[], R[]], [L[], R[]]] {
	return [
		(previousValue: [L[], R[]], currentValue: E, currentIndex: number, array: E[]) => {
			const side = decide(currentValue)
			if (side === -1) {
				return [[...previousValue[0], currentValue as L], previousValue[1]]
			} else {
				return [previousValue[0], [...previousValue[1], currentValue as R]]
			}
		},
		[[] as Array<L>, [] as Array<R>],
	]
}
