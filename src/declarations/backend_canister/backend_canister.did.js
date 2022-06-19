export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'getUserData' : IDL.Func([IDL.Principal], [IDL.Opt(IDL.Text)], ['query']),
    'getUsersSyncedState' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'upsertUsersSyncedState' : IDL.Func([IDL.Text], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
