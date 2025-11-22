<template>
  <router-view />
  <Toaster position="bottom-right" :duration="4000" richColors />
</template>

<script>
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';

export default {
  components: {
    Toaster
  }
};
</script>
