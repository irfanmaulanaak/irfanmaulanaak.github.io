/**
 * Fetch latest GitHub activity across accounts and display it in the footer.
 * Secondary accounts mostly work in private repos, so their repo names are
 * masked as <private_repo>.
 */
(async function () {
    const activityContainer = document.getElementById('github-activity');
    if (!activityContainer) return;

    const ACCOUNTS = [
        { username: 'irfanmaulanaak', maskRepo: false },
        { username: 'irfanm0', maskRepo: true },
        { username: 'irfanmakbar', maskRepo: true }
    ];
    const RELEVANT_TYPES = ['PushEvent', 'PullRequestEvent', 'CreateEvent'];

    const escapeHtml = (str) => str.replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    try {
        const results = await Promise.allSettled(ACCOUNTS.map(async (account) => {
            const response = await fetch(`https://api.github.com/users/${account.username}/events/public`);
            if (!response.ok) throw new Error('API limit or error');
            const events = await response.json();
            return events
                .filter((e) => RELEVANT_TYPES.includes(e.type))
                .map((e) => ({ event: e, maskRepo: account.maskRepo }));
        }));

        const allEvents = results
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => r.value);

        if (!allEvents.length) throw new Error('No events');

        allEvents.sort((a, b) => new Date(b.event.created_at) - new Date(a.event.created_at));
        const { event: recentEvent, maskRepo } = allEvents[0];

        const repoName = maskRepo
            ? '<private_repo>'
            : (recentEvent.repo.name.split('/')[1] || recentEvent.repo.name);
        const safeRepoName = escapeHtml(repoName);
        const timeAgo = getTimeAgo(new Date(recentEvent.created_at));

        let actionText = 'Active on';
        if (recentEvent.type === 'PushEvent') actionText = 'Pushed code to';
        if (recentEvent.type === 'PullRequestEvent') actionText = 'Opened PR on';
        if (recentEvent.type === 'CreateEvent') actionText = 'Created repository';

        activityContainer.innerHTML = `
            <div class="activity-pulse active"></div>
            <p>Live: ${actionText} <strong>${safeRepoName}</strong> ${timeAgo}</p>
        `;
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
