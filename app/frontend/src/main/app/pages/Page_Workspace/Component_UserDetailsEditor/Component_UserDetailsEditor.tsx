import * as React from 'react';
import {ComponentSync, EditableDBItemV3, LL_V_L, TS_BusyButton, TS_PropRenderer} from '@nu-art/thunderstorm/frontend';
import {DB_Account, DBProto_Account} from '@nu-art/user-account';
import './Component_UserDetailsEditor.scss';
import {ModuleFE_Account} from '@nu-art/user-account/frontend';
import {DefaultEditor_OptionalInput} from '@app/common/frontend/core/ui-components';


type Props = {
	account: DB_Account;
	onSubmitCompleted?: VoidFunction;
}

type State = {
	user?: EditableDBItemV3<DBProto_Account>;
}

export class Component_UserDetailsEditor
	extends ComponentSync<Props, State> {

	// ######################### Lifecycle #########################

	protected deriveStateFromProps(nextProps: Props, state: State): State {
		if (!state.user) {
			const account = ModuleFE_Account.cache.unique(nextProps.account._id);
			if (!account)
				return state;

			state.user = new EditableDBItemV3(account, ModuleFE_Account);
		}
		return state;
	}

	// ######################### Logic #########################

	private submitUserChanges = async () => {
		try {
			await this.state.user?.save();
			this.props.onSubmitCompleted?.();
		} catch (err: any) {
			this.logError(err.message, err);
			this.forceUpdate();
		}
	};

	// ######################### Render #########################

	render() {
		const user = this.state.user;
		if (!user)
			return this.renderNoUser();

		return <LL_V_L className={'edit-user-details'}>
			<TS_PropRenderer.Vertical label={'First Name'} error={user.hasError('displayName')}>
				<DefaultEditor_OptionalInput
					editable={user}
					prop={'displayName'}
				/>
			</TS_PropRenderer.Vertical>
			<TS_BusyButton onClick={this.submitUserChanges}>Submit</TS_BusyButton>
		</LL_V_L>;
	}

	private renderNoUser = () => {
		return <div className={'edit-user-details__no-user'}>Could not find user</div>;
	};
}