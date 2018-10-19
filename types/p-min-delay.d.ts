declare module 'p-min-delay' {

	interface PMinDelayOptions {
		delayRejection?: boolean
	}

	function PMinDelay<T> (promise: Promise<T>, delay: number, options?: PMinDelayOptions): Promise<T>

	export = PMinDelay
}
