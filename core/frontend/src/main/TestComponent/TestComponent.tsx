import {ComponentSync} from '@nu-art/thunderstorm/frontend/index';
import './TestComponent.scss';

type Props_TestComponent = {
//
}
type State_TestComponent = {
//
}

export class TestComponent
	extends ComponentSync<Props_TestComponent, State_TestComponent> {

	render() {
		return <div className="test-component">
			Render TestComponent
		</div>;
	}
}