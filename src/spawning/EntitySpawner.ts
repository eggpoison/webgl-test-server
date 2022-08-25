import { SETTINGS } from "webgl-test-shared";
import { EntityCensus } from "../server";
import { spawnPassiveMobs } from "./passive-mob-spawning";

class EntitySpawner {
   /** Expected number of times that a passive mob spawn attempt will occur in a second */
   private static readonly PASSIVE_MOB_SPAWN_ATTEMPT_CHANCE: number = 0.3;

   public tick(entityCensus: EntityCensus): void {
      // Passive mob spawning
      if (Math.random() < EntitySpawner.PASSIVE_MOB_SPAWN_ATTEMPT_CHANCE / SETTINGS.TPS) {
         spawnPassiveMobs(entityCensus.passiveMobCount);
      }
   }
}

export default EntitySpawner;