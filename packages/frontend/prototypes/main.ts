import { createApp } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import "../src/style.css";
import PrototypeGallery from "./PrototypeGallery.vue";

createApp(PrototypeGallery).use(ui).mount("#app");
