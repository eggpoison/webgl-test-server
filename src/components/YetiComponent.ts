import Entity from "../Entity";
import Tile from "../Tile";
import { SnowThrowStage, YETI_SNOW_THROW_COOLDOWN } from "../entities/mobs/yeti";

export class YetiComponent {
   public readonly territory: ReadonlyArray<Tile>;

   // Stores the ids of all entities which have recently attacked the yeti
   public readonly attackingEntities: Record<number, number> = {};

   public attackTarget: Entity | null = null;
   public isThrowingSnow = false;
   public snowThrowStage: SnowThrowStage = SnowThrowStage.windup;
   public snowThrowAttackProgress = 1;
   public snowThrowCooldown = YETI_SNOW_THROW_COOLDOWN;
   public snowThrowHoldTimer = 0;

   constructor(territory: ReadonlyArray<Tile>) {
      this.territory = territory;
   }
}