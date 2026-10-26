"use client";

import { useEffect, useState } from "react";

function getTimeRemaining(endsAt: string) {
	return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

function pad(value: number) {
	return String(value).padStart(2, "0");
}

export default function OfferCountdown({ endsAt }: { endsAt: string }) {
	const [remaining, setRemaining] = useState<number | null>(null);

	useEffect(() => {
		setRemaining(getTimeRemaining(endsAt));
		const interval = window.setInterval(() => setRemaining(getTimeRemaining(endsAt)), 1000);
		return () => window.clearInterval(interval);
	}, [endsAt]);

	if (remaining === null) return <>-- : -- : --</>;
	if (remaining === 0) return <>00 : 00 : 00</>;

	const totalSeconds = Math.floor(remaining / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return <>{days > 0 && `${days}d `}{pad(hours)} : {pad(minutes)} : {pad(seconds)}</>;
}