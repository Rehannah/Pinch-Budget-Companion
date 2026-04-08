export async function clearServiceWorkersAndCaches() {
	try {
		if ("serviceWorker" in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			for (const registration of registrations) {
				await registration.unregister();
			}
		}
	} catch (error) {
		console.warn("SW unregister failed", error);
	}

	try {
		if ("caches" in window) {
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));
		}
	} catch (error) {
		console.warn("Clearing caches failed", error);
	}
}
