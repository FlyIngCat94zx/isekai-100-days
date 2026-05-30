import { createRouter, createWebHashHistory } from 'vue-router'
import Start from '@/views/Start.vue'
import Adventure from '@/views/Adventure.vue'
import GameOver from '@/views/GameOver.vue'

const routes = [
  { path: '/', name: 'start', component: Start },
  { path: '/adventure', name: 'adventure', component: Adventure },
  { path: '/end', name: 'end', component: GameOver }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
