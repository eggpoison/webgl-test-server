import { EntityType, Point, TribeType } from "webgl-test-shared";
import TribeMember from "./TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Tribe from "../../Tribe";
import WanderAI from "../../mob-ai/WanderAI";
import Board from "../../Board";
import ChaseAI from "../../mob-ai/ChaseAI";
import Entity from "../Entity";
import ItemChaseAI from "../../mob-ai/ItemChaseAI";
import DroppedItem from "../../items/DroppedItem";

/*
Priorities while in a tribe:
   1. Keep the tribe totem + other buildings alive
   2. Stay alive by running away from threats when low on health
   3. Protect themselves by fighting back against attackers
   4. Help other tribe members being attacked
   5. Bring resources back to the tribe
   6. Attack mobs/enemies near the tribe area
   7. Gather nearby resources
   8. (DONE) Patrol tribe area
*/

class Tribesman extends TribeMember {
   private static readonly INVENTORY_SIZE = 5;
   
   private static readonly VISION_RANGE = 320;

   private static readonly WALK_SPEED = 75;
   private static readonly WALK_ACCELERATION = 150;

   private static readonly RUN_SPEED = 150;
   private static readonly RUN_ACCELERATION = 300;

   private static readonly ENEMY_TARGETS: ReadonlyArray<EntityType> = ["slime", "yeti", "zombie"];
   private static readonly RESOURCE_TARGETS: ReadonlyArray<EntityType> = ["cow", "cactus", "tree", "berry_bush", "boulder", "ice_spikes"];

   /** How far away from the entity the attack is done */
   private static readonly ATTACK_OFFSET = 80;
   /** Max distance from the attack position that the attack will be registered from */
   private static readonly ATTACK_RADIUS = 60;
   private static readonly ATTACK_KNOCKBACK = 150;

   /** How far the tribesmen will try to stay away from the entity they're attacking */
   private static readonly DESIRED_ATTACK_DISTANCE = 120;
   
   constructor(position: Point, isNaturallySpawned: boolean, tribe: Tribe, tribeType: TribeType) {
      super(position, "tribesman", Tribesman.VISION_RANGE, isNaturallySpawned, tribeType);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);

      const inventoryComponent = this.getComponent("inventory")!;
      inventoryComponent.createNewInventory("inventory", Tribesman.INVENTORY_SIZE, 1);

      this.tribe = tribe;

      // AI for attacking enemies
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1,
         terminalVelocity: Tribesman.RUN_SPEED,
         acceleration: Tribesman.RUN_ACCELERATION,
         desiredDistance: Tribesman.DESIRED_ATTACK_DISTANCE,
         entityIsChased: (entity: Entity): boolean => {
            return Tribesman.ENEMY_TARGETS.includes(entity.type);
         },
         callback: (targetEntity: Entity | null) => {
            if (targetEntity === null) return;
            
            this.attack();
         }
      }));

      // AI for picking up items
      this.addAI(new ItemChaseAI(this, {
         aiWeightMultiplier: 0.8,
         acceleration: Tribesman.WALK_ACCELERATION,
         terminalVelocity: Tribesman.WALK_SPEED,
         itemIsChased: (_item: DroppedItem): boolean => {
            return true;
         }
      }));

      // AI for gathering resources
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 0.6,
         terminalVelocity: Tribesman.RUN_SPEED,
         acceleration: Tribesman.RUN_ACCELERATION,
         desiredDistance: Tribesman.DESIRED_ATTACK_DISTANCE,
         entityIsChased: (entity: Entity): boolean => {
            return Tribesman.RESOURCE_TARGETS.includes(entity.type);
         },
         callback: (targetEntity: Entity | null) => {
            if (targetEntity === null) return;
            
            this.attack();
         }
      }));

      // AI for patrolling tribe area
      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         acceleration: Tribesman.WALK_ACCELERATION,
         terminalVelocity: Tribesman.WALK_SPEED,
         wanderRate: 0.3,
         shouldWander: (position: Point): boolean => {
            if (this.tribe === null) return true;
            
            const tile = Board.getTileAtPosition(position);
            return this.tribe.tileIsInArea(tile.x, tile.y);
         }
      }));
   }

   private attack(): void {
      // Attack the entity
      const attackTargets = this.calculateRadialAttackTargets(Tribesman.ATTACK_OFFSET, Tribesman.ATTACK_RADIUS);
      const target = this.calculateAttackTarget(attackTargets);

      // Register the hit
      if (target !== null) {
         const attackHash = this.id.toString();
         const attackDirection = this.position.calculateAngleBetween(target.position);

         const healthComponent = target.getComponent("health")!; // Attack targets always have a health component
         healthComponent.damage(1, Tribesman.ATTACK_KNOCKBACK, attackDirection, this, attackHash);
         healthComponent.addLocalInvulnerabilityHash(attackHash, 0.3);
      }
   }

   public getClientArgs(): [tribeType: TribeType] {
      return [this.tribeType];
   }
}

export default Tribesman;