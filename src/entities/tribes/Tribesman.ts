import { EntityType, InventoryData, ItemSlotsData, Point, TribeType } from "webgl-test-shared";
import Tribe from "../../Tribe";
import TribeMember from "./TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import WanderAI from "../../mob-ai/WanderAI";
import Board from "../../Board";
import ChaseAI from "../../mob-ai/ChaseAI";
import Entity from "../Entity";
import ItemChaseAI from "../../mob-ai/ItemChaseAI";
import DroppedItem from "../../items/DroppedItem";
import MoveAI from "../../mob-ai/MoveAI";
import Barrel from "./Barrel";
import TribeHut from "./TribeHut";

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

const chooseTribeType = (spawnPosition: Point): TribeType => {
   const isGoblin = Math.random() < 0.25;
   if (isGoblin) {
      return TribeType.goblins;
   }

   const tile = Board.getTileAtPosition(spawnPosition);
   switch (tile.biomeName) {
      case "grasslands": {
         return TribeType.plainspeople;
      }
      case "desert": {
         return TribeType.barbarians;
      }
      case "tundra": {
         return TribeType.frostlings;
      }
      case "mountains": {
         return TribeType.goblins;
      }
      default: {
         throw new Error(`Can't spawn tribesman in biome '${tile.biomeName}'.`);
      }
   }
}

class Tribesman extends TribeMember {
   private static readonly INVENTORY_SIZE = 3;
   
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

   private static readonly BARREL_DEPOSIT_DISTANCE = 80;
   
   protected readonly footstepInterval = 0.35;
   
   constructor(position: Point, isNaturallySpawned: boolean, tribeType: TribeType, tribe: Tribe | null) {
      super(position, "tribesman", Tribesman.VISION_RANGE, isNaturallySpawned, typeof tribeType !== "undefined" ? tribeType : chooseTribeType(position));

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]);

      const inventoryComponent = this.getComponent("inventory")!;
      inventoryComponent.createNewInventory("inventory", Tribesman.INVENTORY_SIZE, 1);

      if (typeof tribe !== "undefined") {
         this.tribe = tribe;
      } else {
         this.tribe = null;
      }

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

      // AI for returning resources to tribe
      this.addAI(new MoveAI(this, {
         aiWeightMultiplier: 0.9,
         terminalVelocity: Tribesman.WALK_SPEED,
         acceleration: Tribesman.WALK_ACCELERATION,
         getMoveTargetPosition: (): Point | null => {
            if (!this.inventoryIsFull()) return null;

            // Attempt to move to a barrel
            const nearestBarrel = this.findNearestBarrel();
            if (nearestBarrel !== null) {
               return nearestBarrel.position.copy();
            }
            return null;
         },
         callback: () => {
            const nearestBarrel = this.findNearestBarrel();
            if (nearestBarrel !== null) {
               const distance = this.position.calculateDistanceBetween(nearestBarrel.position);
               if (distance <= Tribesman.BARREL_DEPOSIT_DISTANCE) {
                  this.depositResources(nearestBarrel);
               }
            }
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

   private inventoryIsFull(): boolean {
      return this.getComponent("inventory")!.inventoryIsFull("inventory");
   }

   private findNearestBarrel(): Barrel | null {
      if (this.tribe === null) return null;
      
      let minDistance = Number.MAX_SAFE_INTEGER;
      let closestBarrel: Barrel | null = null;
      for (const barrel of this.tribe.getBarrels()) {
         const distance = this.position.calculateDistanceBetween(barrel.position);
         if (distance < minDistance) {
            minDistance = distance;
            closestBarrel = barrel;
         }
      }
      
      return closestBarrel;
   }

   /** Deposit all resources from the tribesman's inventory into a barrel */
   private depositResources(barrel: Barrel): void {
      const tribesmanInventoryComponent = this.getComponent("inventory")!;
      const barrelInventoryComponent = barrel.getComponent("inventory")!;
      
      const tribesmanInventory = tribesmanInventoryComponent.getInventory("inventory");
      for (const [_itemSlot, item] of Object.entries(tribesmanInventory.itemSlots)) {
         // Add the item to the barrel inventory
         const amountAdded = barrelInventoryComponent.addItemToInventory("inventory", item);

         // Remove from the tribesman inventory
         const itemSlot = Number(_itemSlot);
         tribesmanInventoryComponent.consumeItem("inventory", itemSlot, amountAdded);
      }
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

   public getClientArgs(): [tribeType: TribeType, inventory: InventoryData] {
      const inventory = this.getComponent("inventory")!.getInventory("inventory");
      
      const itemSlots: ItemSlotsData = {};
      for (const [itemSlot, item] of Object.entries(inventory.itemSlots)) {
         itemSlots[Number(itemSlot)] = {
            type: item.type,
            count: item.count,
            id: item.id
         };
      }
      
      const inventoryData: InventoryData = {
         width: inventory.width,
         height: inventory.height,
         itemSlots: itemSlots,
         entityID: this.id,
         inventoryName: "inventory"
      };
      
      return [this.tribeType, inventoryData];
   }
}

export default Tribesman;