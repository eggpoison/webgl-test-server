import Board from "../../Board";
import { EntityType, ItemType, PlaceableItemInfo, Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import StackableItem from "./StackableItem";
import TribeMember from "../../entities/tribes/TribeMember";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Hitbox from "../../hitboxes/Hitbox";

enum PlaceableItemHitboxType {
   circular = 0,
   rectangular = 1
}

interface PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType;
}

interface PlaceableItemCircularHitboxInfo extends PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType.circular;
   readonly radius: number;
}

interface PlaceableItemRectangularHitboxInfo extends PlaceableItemHitboxInfo {
   readonly type: PlaceableItemHitboxType.rectangular;
   readonly width: number;
   readonly height: number;
}

const PLACEABLE_ITEM_HITBOX_INFO: Partial<Record<ItemType, PlaceableItemCircularHitboxInfo | PlaceableItemRectangularHitboxInfo>> = {
   [ItemType.workbench]: {
      type: PlaceableItemHitboxType.rectangular,
      width: 80,
      height: 80
   },
   [ItemType.tribe_totem]: {
      type: PlaceableItemHitboxType.circular,
      radius: 50
   },
   [ItemType.tribe_hut]: {
      type: PlaceableItemHitboxType.rectangular,
      width: 80,
      height: 80
   },
   [ItemType.barrel]: {
      type: PlaceableItemHitboxType.circular,
      radius: 40
   },
   [ItemType.campfire]: {
      type: PlaceableItemHitboxType.rectangular,
      width: 104,
      height: 104
   },
   [ItemType.furnace]: {
      type: PlaceableItemHitboxType.rectangular,
      width: 80,
      height: 80
   }
};

abstract class PlaceableItem extends StackableItem implements PlaceableItemInfo {
   private static readonly placeTestRectangularHitbox = new RectangularHitbox();
   private static readonly placeTestCircularHitbox = new CircularHitbox();
   
   public readonly entityType: EntityType;

   constructor(itemType: ItemType, count: number, itemInfo: PlaceableItemInfo) {
      super(itemType, count, itemInfo);

      this.entityType = itemInfo.entityType;
   }

   protected abstract spawnEntity(tribeMember: TribeMember, position: Point): Entity;

   public use(tribeMember: TribeMember, inventoryName: string): void {
      // Calculate the position to spawn the placeable entity at
      const spawnPosition = tribeMember.position.copy();
      const offsetVector = new Vector(SETTINGS.ITEM_PLACE_DISTANCE, tribeMember.rotation);
      spawnPosition.add(offsetVector.convertToPoint());

      // Make sure the placeable item can be placed
      if (!this.canBePlaced(spawnPosition, tribeMember.rotation)) return;
      
      // Spawn the placeable entity
      const placedEntity = this.spawnEntity(tribeMember, spawnPosition);

      // Rotate it to match the entity's rotation
      placedEntity.rotation = tribeMember.rotation;

      super.consumeItem(tribeMember.getComponent("inventory")!, inventoryName, 1);

      tribeMember.callEvents("on_item_place", placedEntity);
   }

   private canBePlaced(spawnPosition: Point, rotation: number): boolean {
      // Update the place test hitbox to match the placeable item's info
      const testHitboxInfo = PLACEABLE_ITEM_HITBOX_INFO[this.type]!

      const tempHitboxObject = {
         position: spawnPosition,
         rotation: rotation
      };

      let placeTestHitbox!: Hitbox;
      if (testHitboxInfo.type === PlaceableItemHitboxType.circular) {
         // Circular
         PlaceableItem.placeTestCircularHitbox.setHitboxInfo(testHitboxInfo.radius);
         placeTestHitbox = PlaceableItem.placeTestCircularHitbox;
      } else {
         // Rectangular
         PlaceableItem.placeTestRectangularHitbox.setHitboxInfo(testHitboxInfo.width, testHitboxInfo.height);
         placeTestHitbox = PlaceableItem.placeTestRectangularHitbox;
      }

      placeTestHitbox.setHitboxObject(tempHitboxObject);
      placeTestHitbox.updatePosition();
      placeTestHitbox.updateHitboxBounds();

      const minChunkX = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[0] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[1] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[2] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor(placeTestHitbox.bounds[3] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      
      const previouslyCheckedEntityIDs = new Set<number>();

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.getEntities()) {
               if (!previouslyCheckedEntityIDs.has(entity.id)) {
                  for (const hitbox of entity.hitboxes) {   
                     if (placeTestHitbox.isColliding(hitbox)) {
                        return false;
                     }
                  }
                  
                  previouslyCheckedEntityIDs.add(entity.id);
               }
            }
         }
      }

      return true;
   }
}

export default PlaceableItem;