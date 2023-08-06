import { Point, TribeType } from "webgl-test-shared";
import TribeMember from "./TribeMember";

class AITribesman extends TribeMember {
   constructor(position: Point, isNaturallySpawned: boolean, tribeType: TribeType) {
      super(position, "ai_tribesman", isNaturallySpawned, tribeType);
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default AITribesman;