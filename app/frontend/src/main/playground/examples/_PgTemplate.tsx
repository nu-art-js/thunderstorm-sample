import * as React from 'react';

type State = {}
type Props = {}

class Pg_Component
	extends React.Component<Props, State> {

	constructor(p: Props) {
		super(p);
		this.state = {}
	}

	render() {
		return <div style={{overflowY: "scroll"}}>Playground Template</div>
	}
}

export const PgDev_Template = {name: "Template Name", renderer: Pg_Component};
