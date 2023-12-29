import { ID_SENTINEL_VALUE } from "../Entity";

export class PlayerComponent {
   /** ID of the tribesman the player is interacting with */
   public interactingEntityID = ID_SENTINEL_VALUE;
}