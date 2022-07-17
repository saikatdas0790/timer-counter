import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface _SERVICE {
  'getUsersSyncedState' : ActorMethod<[], [] | [string]>,
  'upsertUsersSyncedState' : ActorMethod<[string], undefined>,
}
