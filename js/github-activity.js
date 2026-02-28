/**
 * Fetch latest GitHub activity and display it in the footer
 */
(async function () {
    const activityContainer = document.getElementById('github-activity');
    if (!activityContainer) return;

    try {
        const username = 'irfanmaulanaak';
        const response = await fetch(`https://api.github.com/users/${username}/events/public`);

        if (!response.ok) throw new Error('API limit or error');

        const events = await response.json();

        if (events && events.length > 0) {
            // Find the most recent push or PR event
            const recentEvent = events.find(e =>
                e.type === 'PushEvent' ||
                e.type === 'PullRequestEvent' ||
                e.type === 'CreateEvent'
            );

            if (recentEvent) {
                const repoName = recentEvent.repo.name.split('/')[1] || recentEvent.repo.name;
                const timeAgo = getTimeAgo(new Date(recentEvent.created_at));

                let actionText = 'Active on';
                if (recentEvent.type === 'PushEvent') actionText = 'Pushed code to';
                if (recentEvent.type === 'PullRequestEvent') actionText = 'Opened PR on';
                if (recentEvent.type === 'CreateEvent') actionText = 'Created repository';

                activityContainer.innerHTML = `
                    <div class="activity-pulse active"></div>
                    <p>Live: ${actionText} <strong>${repoName}</strong> ${timeAgo}</p>
                `;
            } else {
                activityContainer.innerHTML = `
                    <div class="activity-pulse active"></div>
                    <p>Live: Exploring Web3 ecosystems</p>
                `;
            }
        }
    } catch (error) {
        // Fallback gracefully
        activityContainer.innerHTML = `
            <div class="activity-pulse active"></div>
            <p>Ready to build the future of Web3 & AI</p>
        `;
    }

    // Helper for relative time
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        return Math.floor(seconds) + ' seconds ago';
    }
})();
