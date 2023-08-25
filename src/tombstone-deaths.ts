import { DeathInfo, PlayerCauseOfDeath } from "webgl-test-shared";

abstract class TombstoneDeathManager {
   private static readonly MAX_TRACKED_DEATHS = 100;

   private static readonly deathInfos = new Array<DeathInfo>();
   
   public static registerNewDeath(username: string, causeOfDeath: PlayerCauseOfDeath): void {
      // If the max number of deaths has been exceeded, remove the first one
      if (this.deathInfos.length === this.MAX_TRACKED_DEATHS) {
         this.deathInfos.splice(0, 1);
      }
      
      this.deathInfos.push({
         username: username,
         causeOfDeath: causeOfDeath
      });
   }
   
   public static popDeath(): DeathInfo | null {
      return {
         username: "James Wilson",
         causeOfDeath: PlayerCauseOfDeath.god
      };
      if (this.deathInfos.length === 0) {
         return null;
      }
      
      const deathInfo = this.deathInfos[0];
      this.deathInfos.splice(0, 1);
      return deathInfo;
   }
}

export default TombstoneDeathManager;