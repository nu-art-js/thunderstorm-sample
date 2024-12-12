import {ModuleFE_BaseTheme, ThemeOptions} from '@nu-art/thunderstorm/frontend/modules/ModuleFE_BaseTheme';


export type AppThemeType = {
	theme: 'light' | 'dark'
	device: 'desktop' | 'tablet' | 'mobile'
}

export const AppTheme: ThemeOptions<AppThemeType> = {
	theme: ['light', 'dark'],
	device: ['desktop', 'tablet', 'mobile']
};

class ModuleFE_Theme_Class
	extends ModuleFE_BaseTheme<AppThemeType> {

	constructor() {
		super(AppTheme);
	}
}

export const ModuleFE_Theme = new ModuleFE_Theme_Class();