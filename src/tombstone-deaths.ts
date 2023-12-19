import { DeathInfo, PlayerCauseOfDeath } from "webgl-test-shared";
import Entity from "./GameObject";
import { SERVER } from "./server";

abstract class TombstoneDeathManager {
   private static readonly MAX_TRACKED_DEATHS = 100;

   private static readonly deathInfos = new Array<DeathInfo>();
   
   public static registerNewDeath(player: Entity, causeOfDeath: PlayerCauseOfDeath): void {
      // If the max number of deaths has been exceeded, remove the first one
      if (this.deathInfos.length === this.MAX_TRACKED_DEATHS) {
         this.deathInfos.splice(0, 1);
      }

      const playerData = SERVER.getPlayerDataFromInstance(player);
      if (playerData === null) {
         return;
      }
      
      this.deathInfos.push({
         username: playerData.username,
         causeOfDeath: causeOfDeath
      });
   }
   
   public static popDeath(): DeathInfo | null {
      if (this.deathInfos.length === 0) {
         return null;
      }
      
      const deathInfo = this.deathInfos[0];
      this.deathInfos.splice(0, 1);
      return deathInfo;
   }
}

export default TombstoneDeathManager;