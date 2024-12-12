import {PgDev_WhatsApp} from './PgDev_WhatsApp';
import {PgDev_Palette} from './PgDev_Palette';
import {PgDev_IndexDB} from './PgDev_IndexDB';
import {PgDev_Locales} from './PgDev_Locales';
import {PgDev_Colors} from './PgDev_Colors';
import {PgDev_Fonts} from './PgDev_Fonts';
import {PgDev_Icons} from './PgDev_Icons';
import {PgDev_DraftJs} from './PgDev_DraftJs';
import {PgDev_GraphQL} from './PgDev_GraphQL';
import {PgDev_Analytics} from './PgDev_Analytics';
import {AppToolsScreen, ATS_ActionProcessor, ATS_SyncEnvironment} from '@nu-art/thunderstorm/frontend';
import {ATS_CollectionUpgrades} from '@nu-art/thunderstorm/frontend';
import {ATS_Permissions} from '@nu-art/permissions/frontend';
import {ATS_SyncCollectionToEnv} from './ATS_SyncCollectionToEnv';
import {ATS_AccountEditor} from '@nu-art/user-account/frontend/_ats/account-editor/ATS_AccountEditor';
import {ATS_SessionData} from '@nu-art/user-account/frontend/_ats_session-data/ATS_SessionData';
import {ATS_OpenAI} from '@nu-art/ts-openai/frontend/ATS_OpenAI';
import {ATS_FileUploader} from '@nu-art/file-upload/frontend/ATS_FileUploader';
import {ATS_Toaster} from '@nu-art/thunderstorm/frontend/_ats/ATS_Toaster';
import {ATS_PushPubSub} from '@nu-art/push-pub-sub/frontend/ui/ATS_PushPubSub';
import {ATS_Translation} from '@infra/translations/frontend/pages/ATS_Translation/ATS_Translation';
import {ATS_DependencyViewer} from '@nu-art/ts-dependency-viewer/frontend';


export const PlaygroundScreens: AppToolsScreen[] = [
	PgDev_WhatsApp,
	PgDev_Palette,
	PgDev_IndexDB,
	ATS_AccountEditor.screen,
	ATS_Permissions.screen,
	ATS_Translation.screen,
	ATS_DependencyViewer.screen,
	ATS_SyncEnvironment.screen,
	ATS_ActionProcessor.screen,
	ATS_CollectionUpgrades.screen,
	ATS_SyncCollectionToEnv.screen,
	ATS_OpenAI.screen,
	ATS_FileUploader.screen,
	ATS_PushPubSub.screen,
	ATS_Toaster.screen,
	PgDev_Locales,
	PgDev_Colors,
	PgDev_Fonts,
	PgDev_Icons,
	PgDev_DraftJs,
	PgDev_GraphQL,
	PgDev_Analytics,
	ATS_SessionData.screen,
];

