export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    getUsersSyncedState: IDL.Func([], [IDL.Opt(IDL.Text)], ["query"]),
    upsertUsersSyncedState: IDL.Func([IDL.Text], [], []),
  });
};
export const init = ({ IDL }) => {
  return [];
};
