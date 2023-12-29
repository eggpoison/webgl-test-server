import { TribeType } from "webgl-test-shared";
import Entity from "./Entity";

interface TribeJoinInfo {
   readonly tribeType: TribeType;
   readonly totem: Entity;
   readonly startingTribeMember: Entity;
}

// @Cleanup: We've reworked the whole entity architecture, and this was originally done to combat circular dependencies. Do we still need a tribe buffer?
abstract class TribeBuffer {
   private static joinBuffer = new Array<TribeJoinInfo>();
   
   public static addTribe(type: TribeType, totem: Entity, startingTribeMember: Entity): void {
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