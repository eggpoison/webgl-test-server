import { TribeType } from "webgl-test-shared";
import TribeMember from "./entities/tribes/TribeMember";

class Tribe {
   private readonly type: TribeType;
   
   private readonly members = new Array<TribeMember>();
   
   constructor(type: TribeType) {
      this.type = type;
   }

   public addTribeMember(member: TribeMember): void {
      this.members.push(member);
   }
}

export default Tribe;