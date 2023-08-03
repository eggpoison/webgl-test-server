import { Point, RESOURCE_TYPES, SETTINGS, SlimeOrbData, SlimeSize, randInt } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Board from "../../Board";
import ChaseAI from "../../mob-ai/ChaseAI";

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
      25,
      35
   ];

   private mergeTimer = Slime.MERGE_TIME;

   private eyeRotation = 0;

   public readonly size: SlimeSize;
   public mergeWeight: number;

   private mergeWant = 0;

   private readonly orbs = new Array<SlimeOrbData>();

   constructor(position: Point, isNaturallySpawned: boolean, size: SlimeSize = SlimeSize.small) {
      const itemCreationComponent = new ItemCreationComponent();
      
      super(position, {
         health: new HealthComponent(Slime.MAX_HEALTH[size], false),
         item_creation: itemCreationComponent
      }, "slime", Slime.VISION[size], isNaturallySpawned);

      const speedMultiplier = Slime.SPEED_MULTIPLIERS[size];

      this.mergeWeight = Slime.SLIME_WEIGHTS[size];

      this.addAI("wander", {
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
      });
      // Regular chase AI
      this.addAI("chase", {
         aiWeightMultiplier: 1.5,
         acceleration: 100 * speedMultiplier,
         terminalVelocity: 50 * speedMultiplier,
         entityIsChased: (entity: Entity) => {
            return entity.type !== "slime" && entity.type !== "slimewisp" && !RESOURCE_TYPES.includes(entity.type);
         }
      });
      // Merge AI
      this.addAI("chase", {
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
      });

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
   }

   public tick(): void {
      super.tick();

      this.mergeWant += 1 / SETTINGS.TPS;
      if (this.mergeWant >= Slime.MAX_MERGE_WANT[this.size]) {
         this.mergeWant = Slime.MAX_MERGE_WANT[this.size];
      }

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
         offset: Math.random()
      });
   }
   
   public getClientArgs(): [size: SlimeSize, eyeRotation: number, orbs: ReadonlyArray<SlimeOrbData>] {
      return [this.size, this.eyeRotation, this.orbs];
   }
}

export default Slime;