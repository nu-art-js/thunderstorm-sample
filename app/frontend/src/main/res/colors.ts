// empty line
const lightGray = "#f6f6f6";
const veryLightPink = "#d8d8d8";
const blueGrey = "#8181a8";
const disabledBlue = "#B4C9D0FF";
const lightBlue = "#00CAE0";
const white = "#ffffff";
const gold = "#B5986E";
const amber = "#A15F3E";
const lightRed = "#ffe2dc";
const mint = "#E3EFE2";
const black = "#000000";
const red = "#b61111";
const gray = "#CCCCCC";

function calculateColorWithAlpha(color: string, alpha: number = 1) {
	return color + (255 - Math.round(((1 - alpha) * 256) % 256)).toString(16);
}

export const COLORS = {

	lightGray : (alpha?: number) => calculateColorWithAlpha(lightGray , alpha),
	veryLightPink : (alpha?: number) => calculateColorWithAlpha(veryLightPink , alpha),
	blueGrey : (alpha?: number) => calculateColorWithAlpha(blueGrey , alpha),
	disabledBlue : (alpha?: number) => calculateColorWithAlpha(disabledBlue , alpha),
	lightBlue : (alpha?: number) => calculateColorWithAlpha(lightBlue , alpha),
	white : (alpha?: number) => calculateColorWithAlpha(white , alpha),
	gold : (alpha?: number) => calculateColorWithAlpha(gold , alpha),
	amber : (alpha?: number) => calculateColorWithAlpha(amber , alpha),
	lightRed : (alpha?: number) => calculateColorWithAlpha(lightRed , alpha),
	mint : (alpha?: number) => calculateColorWithAlpha(mint , alpha),
	black : (alpha?: number) => calculateColorWithAlpha(black , alpha),
	red : (alpha?: number) => calculateColorWithAlpha(red , alpha),
	gray : (alpha?: number) => calculateColorWithAlpha(gray , alpha),
};

export type ColorsType = typeof COLORS
