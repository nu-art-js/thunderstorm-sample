import * as React from 'react';


function fontRenderer(text: string, fontFamily: string, color: string = '#000000', fontSize: number = 16) {
	return <div style={{fontFamily, display: 'inline-block', color, fontSize}}>{text}</div>;
}

export const FONTS = {

	poppins_bold: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_bold', color, size),
	poppins_extrabold: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_extrabold', color, size),
	poppins_extralight: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_extralight', color, size),
	poppins_light: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_light', color, size),
	poppins_medium: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_medium', color, size),
	poppins_regular: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_regular', color, size),
	poppins_thin: (text: string, color?: string, size?: number) => fontRenderer(text, 'poppins_thin', color, size),
};

export type FontsType = typeof FONTS

