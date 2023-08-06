import { Point, TribeType } from "webgl-test-shared";
import TribeMember from "./TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Tribe from "../../Tribe";

class Tribesman extends TribeMember {
   constructor(position: Point, isNaturallySpawned: boolean, tribe: Tribe, tribeType: TribeType) {
      super(position, "tribesman", isNaturallySpawned, tribeType);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);

      this.tribe = tribe;
   }

   public getClientArgs(): [tribeType: TribeType] {
      return [this.tribeType];
   }
}

export default Tribesman;