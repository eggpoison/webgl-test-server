import { GameObject } from "./GameObject";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";

class Chunk {
   /** Stores all game objects inside the chunk */
   private readonly gameObjects = new Set<GameObject>();
   
   private readonly entities = new Set<Entity>();
   private readonly droppedItems = new Set<DroppedItem>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addGameObject(gameObject: GameObject): void {
      this.gameObjects.add(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities.add(gameObject);
            break;
         }
         case "droppedItem": {
            this.droppedItems.add(gameObject);
            break;
         }
      }
   }

   public removeGameObject(gameObject: GameObject): void {
      this.gameObjects.delete(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities.delete(gameObject);
            break;
         }
         case "droppedItem": {
            this.droppedItems.delete(gameObject);
            break;
         }
      }
   }

   public getEntities(): Set<Entity> {
      return this.entities;
   }

   public getDroppedItems(): Set<DroppedItem> {
      return this.droppedItems;
   }

   public getGameObjects(): Set<GameObject> {
      return this.gameObjects;
   }
}

export default Chunk;