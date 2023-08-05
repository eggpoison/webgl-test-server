import { Mutable, Point, RESOURCE_TYPES, SETTINGS, SlimeOrbData, SlimeSize, lerp, randFloat, randInt } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Board from "../../Board";
import ChaseAI from "../../mob-ai/ChaseAI";
import WanderAI from "../../mob-ai/WanderAI";
import MoveAI from "../../mob-ai/MoveAI";
import { errorMonitor } from "ws";

interface MovingOrbData extends Mutable<SlimeOrbData> {
   angularVelocity: number;
}

interface EntityAnger {
   angerAmount: number;
   readonly target: Entity;
}

interface AngerPropagationInfo {
   chainLength: number;
}

class Slime extends Mob {
   private static readonly MAX_HEALTH: ReadonlyArray<number> = [
      10, // small slime
      15, // medium slime
      25  // large slime
   ];

   private static readonly RADIUSES: ReadonlyArray<number> = [
      32, // small slime
      44, // medium slime
      60  // large slime
   ];

   private static readonly CONTACT_DAMAGE: ReadonlyArray<number> = [
      1, // small slime
      2, // medium slime
      3  // large slime
   ];

   private static readonly SPEED_MULTIPLIERS: ReadonlyArray<number> = [
      2.5, // small slime
      1.75, // medium slime
      1  // large slime
   ];

   /** Weights of each type of slime and slimewisp used when merging */
   private static readonly SLIME_WEIGHTS: ReadonlyArray<number> = [
      2, // small slime
      5, // medium slime
      11 // large slime
   ];

   private static readonly VISION: ReadonlyArray<number> = [
      200, // small slime
      250, // medium slime
      300 // large slime
   ];

   private static readonly SLIME_DROP_AMOUNTS: ReadonlyArray<[minDropAmount: number, maxDropAmount: number]> = [
      [1, 2], // small slime
      [3, 5], // medium slime
      [6, 9] // large slime
   ];

   private static readonly MERGE_TIME = 1.5;

   private static readonly MAX_MERGE_WANT: ReadonlyArray<number> = [
      15,
      40,
      75
   ];

   private static readonly ANGER_DIFFUSE_MULTIPLIER = 0.15;
   
   private static readonly MAX_ANGER_PROPAGATION_CHAIN_LENGTH = 5;
   
   private mergeTimer = Slime.MERGE_TIME;

   private eyeRotation = 0;

   public readonly size: SlimeSize;
   public mergeWeight: number;

   private mergeWant = 0;

   private readonly orbs = new Array<MovingOrbData>();

   private readonly angeredEntities = new Array<EntityAnger>();

   constructor(position: Point, isNaturallySpawned: boolean, size: SlimeSize = SlimeSize.small) {
      const itemCreationComponent = new ItemCreationComponent();
      
      super(position, {
         health: new HealthComponent(Slime.MAX_HEALTH[size], false),
         item_creation: itemCreationComponent
      }, "slime", Slime.VISION[size], isNaturallySpawned);

      const speedMultiplier = Slime.SPEED_MULTIPLIERS[size];

      this.mergeWeight = Slime.SLIME_WEIGHTS[size];

      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         acceleration: 60 * speedMultiplier,
         terminalVelocity: 30 * speedMultiplier,
         wanderRate: 0.5,
         validTileTargets: new Set(["sludge", "slime"]),
         shouldWander: (position: Point): boolean => {
            const tileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
            const tileY = Math.floor(position.y / SETTINGS.TILE_SIZE);
            const tile = Board.getTile(tileX, tileY);
            return tile.biomeName === "swamp";
         }
      }));
      // Anger AI
      this.addAI(new MoveAI(this, {
         aiWeightMultiplier: 1.5,
         acceleration: 100 * speedMultiplier,
         terminalVelocity: 50 * speedMultiplier,
         getMoveTargetPosition: (): Point | null => {
            const target = this.getAngerTarget();
            if (target !== null) {
               return target.position.copy();
            }
            return null;
         }
      }));
      // Regular chase AI
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1.25,
         acceleration: 100 * speedMultiplier,
         terminalVelocity: 50 * speedMultiplier,
         entityIsChased: (entity: Entity) => {
            return entity.type !== "slime" && entity.type !== "slimewisp" && !RESOURCE_TYPES.includes(entity.type);
         }
      }));
      // Merge AI
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1,
         acceleration: 60 * speedMultiplier,
         terminalVelocity: 30 * speedMultiplier,
         entityIsChased: (entity: Entity) => {
            if (entity.type === "slime") {
               return this.wantsToMerge(entity as Slime);
            }
            return false;
         },
         callback: (targetEntity: Entity | null): void => {
            if (targetEntity === null) return;
            
            if (this.collidingObjects.has(targetEntity)) {
               this.mergeTimer -= 1 / SETTINGS.TPS;
               if (this.mergeTimer <= 0) {
                  this.merge(targetEntity as Slime);
               }
            } else {
               this.mergeTimer = Slime.MERGE_TIME;
            }
         }
      }));

      const dropAmount = randInt(...Slime.SLIME_DROP_AMOUNTS[size]);
      itemCreationComponent.createItemOnDeath("slimeball", dropAmount);

      this.size = size;

      const radius = Slime.RADIUSES[this.size];
      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: radius
         })
      ]);

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         if (collidingEntity.type === "slime" || collidingEntity.type === "slimewisp" || RESOURCE_TYPES.includes(collidingEntity.type)) return;
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const contactDamage = Slime.CONTACT_DAMAGE[this.size];
            healthComponent.damage(contactDamage, 0, null, this, "slime");
            healthComponent.addLocalInvulnerabilityHash("slime", 0.3);
         }
      });

      this.createEvent("hurt", (_damage: number, attackingEntity: Entity | null): void => {
         if (attackingEntity === null) return;

         this.addEntityAnger(attackingEntity, 1, { chainLength: 0 });
         this.propagateAnger(attackingEntity, 1);
      });
   }

   public tick(): void {
      super.tick();

      this.mergeWant += 1 / SETTINGS.TPS;
      if (this.mergeWant >= Slime.MAX_MERGE_WANT[this.size]) {
         this.mergeWant = Slime.MAX_MERGE_WANT[this.size];
      }

      for (const orb of this.orbs) {
         if (Math.random() < 0.3 / SETTINGS.TPS) {
            orb.angularVelocity = randFloat(-3, 3);
         }
      }

      // Update orb angular velocity
      for (const orb of this.orbs) {
         orb.rotation += orb.angularVelocity / SETTINGS.TPS;
         orb.angularVelocity -= 3 / SETTINGS.TPS;
         if (orb.angularVelocity < 0) {
            orb.angularVelocity = 0;
         }
      }

      // Decrease anger
      for (let i = this.angeredEntities.length - 1; i >= 0; i--) {
         const angerInfo = this.angeredEntities[i];
         angerInfo.angerAmount -= 1 / SETTINGS.TPS * Slime.ANGER_DIFFUSE_MULTIPLIER;
         if (angerInfo.angerAmount <= 0) {
            this.angeredEntities.splice(i, 1);
         }
      }

      // If the slime is angry at an entity, make its eye point towards that entity
      const angerTarget = this.getAngerTarget();
      if (angerTarget !== null) {
         this.eyeRotation = this.position.calculateAngleBetween(angerTarget.position);
      } else {
         // If the slime is chasing an entity make its eye point towards that entity
         let isChasing = false;
         const currentAI = this.getCurrentAI();
         if (currentAI !== null && currentAI.type === "chase") {
            const target = (currentAI as ChaseAI).getChaseTarget();
            if (target !== null) {
               this.eyeRotation = this.position.calculateAngleBetween(target.position);
               isChasing = true;
            }
         }
   
         // When the slime isn't chasing an entity, make it look at random positions
         if (!isChasing) {
            if (this.getCurrentAIType() !== "chase") {
               if (Math.random() < 0.25 / SETTINGS.TPS) {
                  this.eyeRotation = 2 * Math.PI * Math.random();
               }
            }
         }
      }
   }

   /**
    * Determines whether the slime wants to merge with the other slime.
    */
   private wantsToMerge(_otherSlime: Slime): boolean {
      // Don't try to merge with larger slimes
      if (_otherSlime.size > this.size) return false;

      return this.mergeWant >= Slime.MAX_MERGE_WANT[this.size];
   }

   private merge(otherSlime: Slime): void {
      if (otherSlime.isRemoved) return;

      this.mergeWeight += otherSlime.mergeWeight;

      if (this.size < SlimeSize.large && this.mergeWeight >= Slime.SLIME_WEIGHTS[this.size + 1]) {
         const slime = new Slime(new Point((this.position.x + otherSlime.position.x) / 2, (this.position.y + otherSlime.position.y) / 2), false, this.size + 1);

         // Add orbs from the 2 existing slimes
         for (const orb of this.orbs) {
            slime.createNewOrb(orb.size);
         }
         for (const orb of otherSlime.orbs) {
            slime.createNewOrb(orb.size);
         }

         slime.createNewOrb(this.size);
         slime.createNewOrb(otherSlime.size);
         
         this.remove();
      } else {
         // Add the other slime's health
         const otherSlimeHealth = otherSlime.getComponent("health")!.getHealth();
         this.getComponent("health")!.heal(otherSlimeHealth);

         this.createNewOrb(otherSlime.size);

         this.mergeWant = 0;
      }
      
      otherSlime.remove();
   }

   public createNewOrb(size: SlimeSize): void {
      this.orbs.push({
         size: size,
         rotation: 2 * Math.PI * Math.random(),
         offset: Math.random(),
         angularVelocity: 0
      });
   }

   private getAngerTarget(): Entity | null {
      if (this.angeredEntities.length === 0) {
         return null;
      }

      // Target the entity which the slime is angry with the most
      let maxAnger = 0;
      let target!: Entity;
      for (const angerInfo of this.angeredEntities) {
         if (angerInfo.angerAmount > maxAnger) {
            maxAnger = angerInfo.angerAmount;
            target = angerInfo.target;
         }
      }
      
      return target;
   }

   private addEntityAnger(entity: Entity, amount: number, propagationInfo: AngerPropagationInfo): void {
      let alreadyIsAngry = false;
      for (const entityAnger of this.angeredEntities) {
         if (entityAnger.target === entity) {
            const angerOverflow = Math.max(entityAnger.angerAmount + amount - 1, 0);

            entityAnger.angerAmount = Math.min(entityAnger.angerAmount + amount, 1);

            if (angerOverflow > 0) {
               this.propagateAnger(entity, angerOverflow, propagationInfo);
            }

            alreadyIsAngry = true;
            break;
         }
      }

      if (!alreadyIsAngry) {
         this.angeredEntities.push({
            angerAmount: amount,
            target: entity
         });
      }
   }

   private propagateAnger(angeredEntity: Entity, amount: number, propagationInfo: AngerPropagationInfo = { chainLength: 0 }): void {
      // Propagate the anger
      for (const entity of this.entitiesInVisionRange) {
         if (entity.type === "slime") {
            const distance = this.position.calculateDistanceBetween(entity.position);
            const distanceFactor = distance / this.visionRange;

            propagationInfo.chainLength++;

            if (propagationInfo.chainLength <= Slime.MAX_ANGER_PROPAGATION_CHAIN_LENGTH) {
               const propogatedAnger = lerp(amount * 1, amount * 0.4, Math.sqrt(distanceFactor));
               (entity as Slime).addEntityAnger(angeredEntity, propogatedAnger, propagationInfo);
            }

            propagationInfo.chainLength--;
         }
      }
   }
   
   public getClientArgs(): [size: SlimeSize, eyeRotation: number, orbs: ReadonlyArray<SlimeOrbData>] {
      const orbs = new Array<SlimeOrbData>();
      // Convert from moving orbs to regular orbs
      for (const orb of this.orbs) {
         orbs.push({
            offset: orb.offset,
            rotation: orb.rotation,
            size: orb.size
         });
      }
      
      return [this.size, this.eyeRotation, orbs];
   }
}

export default Slime;