import {BuildAndInstall, DefaultPhases} from '@nu-art/build-and-install/build-and-install-v3';
import {BaiParam_Help, phase_Help, Unit_HelpPrinter} from '@nu-art/build-and-install/v3/core/Unit_HelpPrinter';
import {AllBaiParams} from '@nu-art/build-and-install/core/params/params';


(async () => {
	const buildAndInstall = new BuildAndInstall({runtimeParams: [...AllBaiParams, BaiParam_Help]});
	buildAndInstall.setApplicativeUnits([Unit_HelpPrinter]);
	buildAndInstall.setPhases([[phase_Help], ...DefaultPhases]);

	await buildAndInstall.build();
	await buildAndInstall.run();
})()
	.catch(console.error)
	.then(() => process.exit(0));

// .execute()
// 	.then(() => {
// 	})
// 	.catch(err => {
// 		process.on('SIGINT', () => {
// 			console.log('Failed with error: ', err);
// 			return process.exit(1);
// 		});
// 	});

