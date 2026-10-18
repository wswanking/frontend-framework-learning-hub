import { onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
export function useUnsavedChanges(dirty: () => boolean) {
  const check = () => !dirty() || window.confirm('当前编辑尚未保存，放弃修改并离开吗？');
  onBeforeRouteLeave(check);
  onBeforeRouteUpdate(check);
  const unload = (event: BeforeUnloadEvent) => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  onBeforeUnmount(() => window.removeEventListener('beforeunload', unload));
}
