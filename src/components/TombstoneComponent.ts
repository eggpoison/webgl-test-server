import { DeathInfo } from "webgl-test-shared";

export class TombstoneComponent {
   public readonly tombstoneType: number;

   /** Amount of spawned zombies that are alive currently */
   public numZombies = 0;
   public isSpawningZombie = false;
   public zombieSpawnTimer = 0;
   public zombieSpawnPositionX = -1;
   public zombieSpawnPositionY = -1;

   public readonly deathInfo: DeathInfo | null;

   constructor(tombstoneType: number, deathInfo: DeathInfo | null) {
      this.tombstoneType = tombstoneType;
      this.deathInfo = deathInfo;
   }
}