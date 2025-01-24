import {GenericDropDownV3, TemplatingProps_TS_GenericDropDown, TS_MultiSelect_V2} from '@nu-art/thunderstorm/frontend';
import * as React from 'react';
import {ModuleFE_Person} from './ModuleFE_Person';
import {
	DBItemDropDownMultiSelector
} from '@nu-art/thunderstorm/frontend/components/_TS_MultiSelect/DBItemDropDownMultiSelector';
import {DBProto_Person} from '@app/core-shared/_entity/person';


const Props_DropDown: TemplatingProps_TS_GenericDropDown<DBProto_Person> = {
	module: ModuleFE_Person,
	modules: [ModuleFE_Person],
	mapper: item => [item.firstName, item.lastName, item._id],
	placeholder: 'Choose a Person',
	renderer: item => <div className="ll_h_c"> {item.firstName} {item.lastName} </div>
};

export const DropDown_Person = GenericDropDownV3.prepare(Props_DropDown);

const Props_MultiSelect = DBItemDropDownMultiSelector.propsV3({
	module: ModuleFE_Person,
	itemRenderer: (item, onDelete, disabled) => {
		return !item ? <>Not Found</> : <>
			{item.firstName} {item.lastName}
		</>;
	},
	uiSelector: DropDown_Person.selectable,
});

export const MultiSelect_Person: any = TS_MultiSelect_V2.prepare(Props_MultiSelect);