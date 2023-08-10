import Board from "../../Board";
import { EntityType, ItemType, PlaceableItemInfo, Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import StackableItem from "./StackableItem";
import TribeMember from "../../entities/tribes/TribeMember";

type PlaceableItemHitboxInfo = {
   readonly width: number;
   readonly height: number;
}

const PLACEABLE_ITEM_HITBOX_INFO: Partial<Record<ItemType, PlaceableItemHitboxInfo>> = {
   workbench: {
      width: 80,
      height: 80
   },
   tribe_totem: {
      width: 100,
      height: 100
   },
   tribe_hut: {
      width: 80,
      height: 80
   },
   barrel: {
      width: 80,
      height: 80
   },
   campfire: {
      width: 80,
      height: 80
   },
   furnace: {
      width: 80,
      height: 80
   }
};

abstract class PlaceableItem extends StackableItem implements PlaceableItemInfo {
   private static readonly placeTestHitbox: RectangularHitbox = new RectangularHitbox();
   
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
      const { width, height } = PLACEABLE_ITEM_HITBOX_INFO[this.type]!;

      const tempHitboxObject = {
         position: spawnPosition,
         rotation: rotation
      };

      PlaceableItem.placeTestHitbox.setHitboxObject(tempHitboxObject);

      PlaceableItem.placeTestHitbox.setHitboxInfo({
         type: "rectangular",
         width: width,
         height: height
      });

      PlaceableItem.placeTestHitbox.updatePosition();
      PlaceableItem.placeTestHitbox.computeVertexPositions();
      PlaceableItem.placeTestHitbox.calculateSideAxes();

      const minChunkX = Math.max(Math.min(Math.floor((spawnPosition.x - width / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((spawnPosition.x + width / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((spawnPosition.y - height / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((spawnPosition.y + height / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      
      const previouslyCheckedEntityIDs = new Set<number>();

      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.getEntities()) {
               if (!previouslyCheckedEntityIDs.has(entity.id)) {
                  for (const hitbox of entity.hitboxes) {   
                     if (PlaceableItem.placeTestHitbox.isColliding(hitbox)) {
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