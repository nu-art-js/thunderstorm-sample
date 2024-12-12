import * as React from 'react';
import {_className, ComponentSync, StorageKey} from '@nu-art/thunderstorm/frontend';
import './TS_DevPage.scss';
import {ICONSV4} from '@app/common/frontend/icons';


type DevPageMetaData = {
	selectedPage?: string;
	selectionOpen: boolean;
}

type Renderable = React.ReactNode | (() => React.ReactNode)
const renderableResolver = (toRender: Renderable) => typeof toRender === 'function' ? toRender() : toRender;
const storage_devPageMetaData = new StorageKey<DevPageMetaData>('dev-page-meta-data');

export type DevPage = {
	label: string;
	key: string;
	renderer: React.ComponentType;
	icon?: Renderable;
}

type Props = {
	pages: DevPage[];
	header: Renderable;
};

type State = {
	selectedPageKey?: string;
	pageSelectionOpen: boolean;
};

export class TS_DevPage
	extends ComponentSync<Props, State> {

	// ######################### Life Cycle #########################
	constructor(p: Props) {
		super(p);
	}

	protected deriveStateFromProps(nextProps: Props, state: State): State {
		const devPageData = storage_devPageMetaData.get({selectionOpen: false});
		state.selectedPageKey = devPageData.selectedPage;
		state.pageSelectionOpen = devPageData.selectionOpen;
		return state;
	}

	// ######################### Logic #########################

	onPageSelect(selectedPageKey: string) {
		this.setState({selectedPageKey});
		const data = storage_devPageMetaData.get({selectionOpen: false});
		storage_devPageMetaData.set({...data, selectedPage: selectedPageKey});
	}

	onToggleMenu = () => {
		const opened = !this.state.pageSelectionOpen;
		this.setState({pageSelectionOpen: opened});
		const data = storage_devPageMetaData.get();
		storage_devPageMetaData.set({...data, selectionOpen: opened});
	};

	private devPageKeyHandler = (e: React.KeyboardEvent) => {
		if (e.key.toLowerCase() === 'q' && e.shiftKey) {
			this.setState({selectedPageKey: undefined});
			storage_devPageMetaData.delete();
		}
	};

	// ######################### Render #########################

	static renderPageHeader(title: string) {
		return <div className={'ts-dev-page__page-header'}>{title}</div>;
	}

	private renderHeader() {
		const header = renderableResolver(this.props.header);
		const className = _className('ts-dev-page__header__toggle-menu-icon', this.state.pageSelectionOpen ? 'opened' : undefined);
		return <div className={'ts-dev-page__header'}>
			<ICONSV4.debug className={className} onClick={this.onToggleMenu}/>
			<div className={'ts-dev-page__header__head'}>{header}</div>
		</div>;
	}

	private renderPageSelection() {
		const className = _className('ts-dev-page__page-selection-container', this.state.pageSelectionOpen ? 'opened' : undefined);
		return <div className={className}>
			{this.props.pages.map(page => {
				const icon = page.icon ? renderableResolver(page.icon) : <ICONSV4.debug className={'ts-dev-page__page-selection__page-icon'}/>;
				return <div
					key={page.key}
					className={_className('ts-dev-page__page-selection__page', page.key === this.state.selectedPageKey ? 'selected' : undefined)}
					onClick={() => this.onPageSelect(page.key)}
				>
					{icon}
					<div className={'ts-dev-page__page-selection__page-label'}>{page.label}</div>
				</div>;
			})}
		</div>;
	}

	private renderPage() {
		const page = this.props.pages.find(item => item.key === this.state.selectedPageKey);
		const Renderer = page ? page.renderer : this.renderNoPage;
		return <Renderer/>;
	}

	private renderNoPage() {
		return <div className={'ts-dev-page__no-page'}>
			<div className={'ts-dev-page__no-page__title'}>Welcome To Dev!</div>
			<div className={'ts-dev-page__no-page__text'}>Select a page from the selection on the left of the page</div>
		</div>;
	}

	render() {
		return <div className={'ts-dev-page'} onKeyDown={this.devPageKeyHandler} tabIndex={0}>
			{this.renderHeader()}
			<div className={'ts-dev-page__main'}>
				{this.renderPageSelection()}
				<div className={'ts-dev-page__main-content'}>
					{this.renderPage()}
				</div>
			</div>
		</div>;
	}
}