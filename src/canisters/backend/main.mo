import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Principal "mo:base/Principal";
import Text "mo:base/Text";

actor {
    stable var allUsersListArrayForUpgrade: [(Principal, Text)] = [];
    var allUsersList = HashMap.fromIter<Principal, Text>(allUsersListArrayForUpgrade.vals(), 1000, Principal.equal, Principal.hash);

    system func preupgrade() {
      allUsersListArrayForUpgrade := Iter.toArray(allUsersList.entries());
    };

    system func postupgrade() {
      allUsersListArrayForUpgrade := [];
    };

    public shared query({caller}) func getUsersSyncedState(): async ?Text {
      return allUsersList.get(caller);
    };

    public shared({caller}) func upsertUsersSyncedState(stringifiedJSON: Text): async () {
      allUsersList.put(caller, stringifiedJSON);
    };
};