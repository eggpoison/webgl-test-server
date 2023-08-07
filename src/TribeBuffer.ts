import { EntityType, TribeType } from "webgl-test-shared";
import TribeTotem from "./entities/tribes/TribeTotem";
import TribeMember from "./entities/tribes/TribeMember";

interface TribeJoinInfo {
   readonly tribeType: TribeType;
   readonly totem: TribeTotem;
   readonly startingTribeMember: TribeMember;
}

abstract class TribeBuffer {
   private static joinBuffer = new Array<TribeJoinInfo>();
   
   public static addTribe(type: TribeType, totem: TribeTotem, startingTribeMember: TribeMember): void {
      this.joinBuffer.push({
         tribeType: type,
         totem: totem,
         startingTribeMember: startingTribeMember
      });
   }

   public static popTribe(): TribeJoinInfo {
      if (this.joinBuffer.length === 0) {
         throw new Error("Entity buffer had no entities.");
      }
      
      const joinInfo = this.joinBuffer[0];
      this.joinBuffer.splice(0, 1);

      return joinInfo;
   }

   public static hasTribes(): boolean {
      return this.joinBuffer.length > 0;
   }
}

export default TribeBuffer;